const { CONFIG_KEY, DEFAULT_CONFIG } = require('../constants');

function cloneConfig(config) {
    return JSON.parse(JSON.stringify(config));
}

function normalizeWindow(windowConfig) {
    const start = typeof windowConfig?.start === 'string' ? windowConfig.start : '09:00';
    const end = typeof windowConfig?.end === 'string' ? windowConfig.end : '17:00';
    return { start, end };
}

function normalizeNumber(value, fallback, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }

    return Math.max(min, Math.min(max, Math.round(parsed)));
}

function normalizeConfig(value) {
    const schedule = value && typeof value === 'object' ? value.schedule : null;
    const windows = Array.isArray(schedule?.windows)
        ? schedule.windows.map(normalizeWindow).filter((windowConfig) => windowConfig.start && windowConfig.end)
        : cloneConfig(DEFAULT_CONFIG.schedule.windows);

    return {
        idleMs: normalizeNumber(value?.idleMs, DEFAULT_CONFIG.idleMs, 250, 3600000),
        radius: normalizeNumber(value?.radius, DEFAULT_CONFIG.radius, 1, 2000),
        speed: normalizeNumber(value?.speed, DEFAULT_CONFIG.speed, 1, 360),
        rotateIntervalMs: normalizeNumber(value?.rotateIntervalMs, DEFAULT_CONFIG.rotateIntervalMs, 1, 1000),
        pollIntervalMs: normalizeNumber(value?.pollIntervalMs, DEFAULT_CONFIG.pollIntervalMs, 10, 5000),
        tolerancePx: normalizeNumber(value?.tolerancePx, DEFAULT_CONFIG.tolerancePx, 0, 100),
        schedule: {
            enabled: Boolean(schedule?.enabled),
            randomOffsetMinutes: normalizeNumber(
                schedule?.randomOffsetMinutes,
                DEFAULT_CONFIG.schedule.randomOffsetMinutes,
                0,
                180
            ),
            windows: windows.length > 0 ? windows : cloneConfig(DEFAULT_CONFIG.schedule.windows)
        }
    };
}

class ConfigStore {
    constructor(extensionContext) {
        this.extensionContext = extensionContext;
    }

    load() {
        return normalizeConfig(this.extensionContext.globalState.get(CONFIG_KEY, DEFAULT_CONFIG));
    }

    async save(config) {
        const normalized = normalizeConfig(config);
        await this.extensionContext.globalState.update(CONFIG_KEY, normalized);
        return normalized;
    }
}

module.exports = {
    ConfigStore,
    cloneConfig,
    normalizeConfig
};
