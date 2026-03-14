const CONFIG_KEY = 'codeViewerBot.config';
const PANEL_TYPE = 'codeViewerBot.configPanel';
const INSTANCE_LOCK_FILENAME = 'instance-lock.json';
const LEGACY_WORKSPACE_EXCLUDE_GLOB = '**/{node_modules,.git,dist,out,coverage,.next,.nuxt,vendor}/**';
const DEFAULT_WORKSPACE_EXCLUDE_GLOB = '{**/{node_modules,.git,.vscode,dist,out,coverage,.next,.nuxt,vendor}/**,**/*.code-workspace}';

const DEFAULT_CONFIG = {
    motion: {
        enabled: true,
        idleMs: 120000,
        radius: 20,
        speed: 1,
        rotateIntervalMs: 10,
        pollIntervalMs: 50,
        tolerancePx: 3
    },
    instanceControl: {
        singleInstance: true
    },
    workspace: {
        enabled: false,
        scanMode: 'popular',
        preferredExtension: '.js',
        openMode: 'same-tab',
        idleMs: 30000,
        advanceIntervalMs: 30000,
        excludeGlob: DEFAULT_WORKSPACE_EXCLUDE_GLOB
    },
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
    INSTANCE_LOCK_FILENAME,
    LEGACY_WORKSPACE_EXCLUDE_GLOB,
    DEFAULT_WORKSPACE_EXCLUDE_GLOB,
    DEFAULT_CONFIG
};
