const { parseTimeToMinutes, formatMinutes, getDateKey } = require('../utils/time');
const { randomInt } = require('../utils/math');

class ScheduleService {
    constructor({ logger }) {
        this.logger = logger;
        this.config = null;
        this.dailySchedule = {
            dateKey: null,
            windows: []
        };
    }

    setConfig(config) {
        this.config = config;
        this.dailySchedule = {
            dateKey: null,
            windows: []
        };
    }

    ensureDailySchedule(now = new Date()) {
        if (!this.config?.schedule.enabled) {
            return false;
        }

        const todayKey = getDateKey(now);
        if (this.dailySchedule.dateKey === todayKey) {
            return false;
        }

        this.buildDailySchedule(now);
        return true;
    }

    buildDailySchedule(now = new Date()) {
        const offsetRange = this.config.schedule.randomOffsetMinutes;
        const windows = this.config.schedule.windows.map((windowConfig) => {
            const startBase = parseTimeToMinutes(windowConfig.start);
            const endBase = parseTimeToMinutes(windowConfig.end);

            let start = startBase + randomInt(-offsetRange, offsetRange);
            let end = endBase + randomInt(-offsetRange, offsetRange);

            start = Math.max(0, start);
            end = Math.min((23 * 60) + 59, end);

            if (end <= start) {
                end = Math.min(start + 1, (23 * 60) + 59);
            }

            return {
                startMinutes: start,
                endMinutes: end,
                startText: formatMinutes(start),
                endText: formatMinutes(end)
            };
        });

        this.dailySchedule = {
            dateKey: getDateKey(now),
            windows
        };

        this.logger(`Schedule for ${this.dailySchedule.dateKey}:`);
        for (const windowConfig of windows) {
            this.logger(`- ${windowConfig.startText} -> ${windowConfig.endText}`);
        }
    }

    isWithinAllowedTime(now = new Date()) {
        if (!this.config?.schedule.enabled) {
            return true;
        }

        this.ensureDailySchedule(now);

        const currentMinutes = (now.getHours() * 60) + now.getMinutes();
        return this.dailySchedule.windows.some((windowConfig) => (
            currentMinutes >= windowConfig.startMinutes &&
            currentMinutes < windowConfig.endMinutes
        ));
    }

    getSummary() {
        if (!this.config?.schedule.enabled) {
            return {
                dateKey: null,
                windows: []
            };
        }

        this.ensureDailySchedule();

        return {
            dateKey: this.dailySchedule.dateKey,
            windows: this.dailySchedule.windows.map((windowConfig) => ({
                start: windowConfig.startText,
                end: windowConfig.endText
            }))
        };
    }
}

module.exports = {
    ScheduleService
};
