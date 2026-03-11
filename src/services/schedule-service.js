const { parseTimeToMinutes, formatMinutes, getDateKey } = require('../utils/time');
const { randomInt } = require('../utils/math');

const createScheduleService = ({ logger }) => {
    let config = null;
    let dailySchedule = {
        dateKey: null,
        windows: []
    };

    const setConfig = (nextConfig) => {
        config = nextConfig;
        dailySchedule = {
            dateKey: null,
            windows: []
        };
    };

    const buildDailySchedule = (now = new Date()) => {
        const offsetRange = config.schedule.randomOffsetMinutes;
        const windows = config.schedule.windows.map((windowConfig) => {
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

        dailySchedule = {
            dateKey: getDateKey(now),
            windows
        };

        logger(`Schedule for ${dailySchedule.dateKey}:`);
        for (const windowConfig of windows) {
            logger(`- ${windowConfig.startText} -> ${windowConfig.endText}`);
        }
    };

    const ensureDailySchedule = (now = new Date()) => {
        if (!config?.schedule.enabled) {
            return false;
        }

        const todayKey = getDateKey(now);
        if (dailySchedule.dateKey === todayKey) {
            return false;
        }

        buildDailySchedule(now);
        return true;
    };

    const isWithinAllowedTime = (now = new Date()) => {
        if (!config?.schedule.enabled) {
            return true;
        }

        ensureDailySchedule(now);

        const currentMinutes = (now.getHours() * 60) + now.getMinutes();
        return dailySchedule.windows.some((windowConfig) => (
            currentMinutes >= windowConfig.startMinutes &&
            currentMinutes < windowConfig.endMinutes
        ));
    };

    const getSummary = () => {
        if (!config?.schedule.enabled) {
            return {
                dateKey: null,
                windows: []
            };
        }

        ensureDailySchedule();

        return {
            dateKey: dailySchedule.dateKey,
            windows: dailySchedule.windows.map((windowConfig) => ({
                start: windowConfig.startText,
                end: windowConfig.endText
            }))
        };
    };

    return {
        setConfig,
        ensureDailySchedule,
        isWithinAllowedTime,
        getSummary
    };
};

module.exports = {
    createScheduleService
};
