const CONFIG_KEY = 'codeViewerBot.config';
const PANEL_TYPE = 'codeViewerBot.configPanel';

const DEFAULT_CONFIG = {
    idleMs: 2000,
    radius: 100,
    speed: 3,
    rotateIntervalMs: 10,
    pollIntervalMs: 50,
    tolerancePx: 3,
    schedule: {
        enabled: true,
        randomOffsetMinutes: 5,
        windows: [
            { start: '09:00', end: '13:00' },
            { start: '14:00', end: '18:00' }
        ]
    }
};

module.exports = {
    CONFIG_KEY,
    PANEL_TYPE,
    DEFAULT_CONFIG
};
