const {
    CONFIG_KEY,
    DEFAULT_CONFIG,
    LEGACY_WORKSPACE_EXCLUDE_GLOB,
    DEFAULT_WORKSPACE_EXCLUDE_GLOB
} = require('../constants');

const cloneConfig = (config) => JSON.parse(JSON.stringify(config));

const normalizeWindow = (windowConfig) => {
    const start = typeof windowConfig?.start === 'string' ? windowConfig.start : '09:00';
    const end = typeof windowConfig?.end === 'string' ? windowConfig.end : '17:00';
    return { start, end };
};

const normalizeNumber = (value, fallback, min, max) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }

    return Math.max(min, Math.min(max, Math.round(parsed)));
};

const normalizeExtension = (value, fallback) => {
    const raw = typeof value === 'string' ? value.trim() : fallback;
    if (!raw) {
        return fallback;
    }

    return raw.startsWith('.') ? raw.toLowerCase() : `.${raw.toLowerCase()}`;
};

const normalizeString = (value, fallback) => {
    const raw = typeof value === 'string' ? value.trim() : '';
    return raw || fallback;
};

const normalizeExcludeGlob = (value) => {
    const normalized = normalizeString(value, DEFAULT_WORKSPACE_EXCLUDE_GLOB);
    if (normalized === LEGACY_WORKSPACE_EXCLUDE_GLOB) {
        return DEFAULT_WORKSPACE_EXCLUDE_GLOB;
    }

    return normalized;
};

const normalizeConfig = (value) => {
    const schedule = value && typeof value === 'object' ? value.schedule : null;
    const workspace = value && typeof value === 'object' ? value.workspace : null;
    const motion = value && typeof value === 'object' ? value.motion : null;
    const windows = Array.isArray(schedule?.windows)
        ? schedule.windows.map(normalizeWindow).filter((windowConfig) => windowConfig.start && windowConfig.end)
        : cloneConfig(DEFAULT_CONFIG.schedule.windows);

    return {
        motion: {
            enabled: motion?.enabled !== false,
            idleMs: normalizeNumber(
                motion?.idleMs ?? value?.idleMs,
                DEFAULT_CONFIG.motion.idleMs,
                250,
                3600000
            ),
            radius: normalizeNumber(
                motion?.radius ?? value?.radius,
                DEFAULT_CONFIG.motion.radius,
                1,
                2000
            ),
            speed: normalizeNumber(
                motion?.speed ?? value?.speed,
                DEFAULT_CONFIG.motion.speed,
                1,
                360
            ),
            rotateIntervalMs: normalizeNumber(
                motion?.rotateIntervalMs ?? value?.rotateIntervalMs,
                DEFAULT_CONFIG.motion.rotateIntervalMs,
                1,
                1000
            ),
            pollIntervalMs: normalizeNumber(
                motion?.pollIntervalMs ?? value?.pollIntervalMs,
                DEFAULT_CONFIG.motion.pollIntervalMs,
                10,
                5000
            ),
            tolerancePx: normalizeNumber(
                motion?.tolerancePx ?? value?.tolerancePx,
                DEFAULT_CONFIG.motion.tolerancePx,
                0,
                100
            )
        },
        instanceControl: {
            singleInstance: value?.instanceControl?.singleInstance !== false
        },
        workspace: {
            enabled: Boolean(workspace?.enabled),
            scanMode: workspace?.scanMode === 'extension' ? 'extension' : 'popular',
            preferredExtension: normalizeExtension(
                workspace?.preferredExtension,
                DEFAULT_CONFIG.workspace.preferredExtension
            ),
            openMode: workspace?.openMode === 'new-tab' ? 'new-tab' : 'same-tab',
            idleMs: normalizeNumber(
                workspace?.idleMs,
                DEFAULT_CONFIG.workspace.idleMs,
                10000,
                60000
            ),
            advanceIntervalMs: normalizeNumber(
                workspace?.advanceIntervalMs,
                DEFAULT_CONFIG.workspace.advanceIntervalMs,
                10000,
                60000
            ),
            excludeGlob: normalizeExcludeGlob(workspace?.excludeGlob)
        },
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
};

const createConfigStore = (extensionContext) => ({
    load: () => normalizeConfig(extensionContext.globalState.get(CONFIG_KEY, DEFAULT_CONFIG)),
    save: async (config) => {
        const normalized = normalizeConfig(config);
        await extensionContext.globalState.update(CONFIG_KEY, normalized);
        return normalized;
    }
});

module.exports = {
    createConfigStore,
    cloneConfig,
    normalizeConfig
};
