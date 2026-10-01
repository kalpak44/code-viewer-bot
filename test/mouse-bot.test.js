let mockRobotAvailable = true;

const mockRobot = {
    getMousePos: jest.fn(() => ({ x: 0, y: 0 })),
    moveMouse: jest.fn()
};

jest.mock(
    'robotjs',
    () => {
        if (!mockRobotAvailable) {
            throw new Error('robotjs is not available');
        }

        return mockRobot;
    },
    { virtual: true }
);

jest.mock('node:fs/promises', () => ({
    open: jest.fn(async () => ({
        read: jest.fn(async (buffer) => {
            const data = Buffer.from('const value = 1;\n', 'utf8');
            data.copy(buffer);
            return { bytesRead: data.length };
        }),
        close: jest.fn(async () => {})
    }))
}));

const mockVscode = {
    window: {
        activeTextEditor: null,
        showInformationMessage: jest.fn(),
        showWarningMessage: jest.fn(),
        showTextDocument: jest.fn(async () => {})
    },
    workspace: {
        workspaceFolders: [],
        findFiles: jest.fn(() => new Promise(() => {})),
        openTextDocument: jest.fn(async (uri) => ({ uri }))
    },
    commands: {
        executeCommand: jest.fn(async () => {})
    }
};

jest.mock('vscode', () => mockVscode, { virtual: true });

const { normalizeConfig } = require('../src/config/config-store');
const { createMouseBot } = require('../src/services/mouse-bot');

const START = new Date(2026, 4, 12, 12, 0, 0);
const POLL_MS = 10;

const configWith = (overrides = {}) => ({
    motion: {
        enabled: true,
        idleMs: 250,
        pollIntervalMs: POLL_MS,
        rotateIntervalMs: 1000,
        ...overrides.motion
    },
    workspace: {
        enabled: false,
        idleMs: 10000,
        advanceIntervalMs: 10000,
        ...overrides.workspace
    },
    schedule: {
        enabled: false,
        randomOffsetMinutes: 0,
        ...overrides.schedule
    }
});

const createCoordinator = () => ({
    owned: true,
    singleInstance: true,
    owner: null,
    isOwner() {
        return this.owned;
    },
    getState() {
        return {
            isOwner: this.owned,
            singleInstance: this.singleInstance,
            owner: this.owner
        };
    },
    refreshOwnership: jest.fn(async () => {}),
    updateConfig: jest.fn(async () => {})
});

const buildBot = (
    config = configWith(),
    coordinator = createCoordinator(),
    create = createMouseBot
) => {
    const states = [];
    const bot = create({
        initialConfig: normalizeConfig(config),
        logger: jest.fn(),
        instanceCoordinator: coordinator,
        onStateChange: (state) => states.push(state)
    });

    return { bot, coordinator, states };
};

const at = (millisecondsAfterStart) => new Date(START.getTime() + millisecondsAfterStart);

// Fires exactly one poll tick: the timer clock advances 10ms while the wall clock jumps
// wherever the test needs it to, so a single tick can observe any idle age.
const tick = () => jest.advanceTimersByTime(POLL_MS);

const setWallClock = (date) => jest.setSystemTime(date);

const flushMicrotasks = async () => {
    for (let index = 0; index < 100; index += 1) {
        await Promise.resolve();
    }
};

const useWorkspaceWithFiles = () => {
    mockVscode.workspace.workspaceFolders = [{ uri: { fsPath: '/workspace' } }];
    mockVscode.workspace.findFiles.mockResolvedValue([
        { fsPath: '/workspace/a.js' },
        { fsPath: '/workspace/b.js' }
    ]);
};

beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(START);
    mockRobotAvailable = true;
    mockRobot.getMousePos.mockReturnValue({ x: 0, y: 0 });
    mockRobot.moveMouse.mockReset();
    mockVscode.window.activeTextEditor = null;
    mockVscode.window.showInformationMessage.mockReset();
    mockVscode.window.showWarningMessage.mockReset();
    mockVscode.workspace.workspaceFolders = [];
    mockVscode.workspace.findFiles.mockReset();
    mockVscode.workspace.findFiles.mockImplementation(() => new Promise(() => {}));
});

afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
});

describe('mouse-bot status reporting', () => {
    test('reports Stopped before the bot starts', () => {
        const { bot } = buildBot();

        expect(bot.getState().statusText).toBe('Stopped');
        expect(bot.getState().workspaceStatusText).toBe('Workspace browsing disabled.');
    });

    test('reports standby while another single instance owns the lease', async () => {
        const coordinator = createCoordinator();
        coordinator.owned = false;
        coordinator.owner = { label: 'Editor A' };
        const { bot } = buildBot(configWith({ workspace: { enabled: true } }), coordinator);

        await bot.start();

        const state = bot.getState();
        expect(state.statusText).toBe('Standby (Editor A active)');
        expect(state.workspaceStatusText).toBe(
            'Workspace browsing paused: active window is Editor A.'
        );
    });

    test('names an unlabelled owner generically', async () => {
        const coordinator = createCoordinator();
        coordinator.owned = false;
        const { bot } = buildBot(configWith({ workspace: { enabled: true } }), coordinator);

        await bot.start();

        expect(bot.getState().statusText).toBe('Standby (another window active)');
        expect(bot.getState().workspaceStatusText).toBe(
            'Workspace browsing paused: active window is another window.'
        );
    });

    test('reports active in this window when single-instance control is off', async () => {
        const coordinator = createCoordinator();
        coordinator.owned = false;
        coordinator.singleInstance = false;
        const { bot } = buildBot(configWith({ workspace: { enabled: true } }), coordinator);

        await bot.start();

        const state = bot.getState();
        expect(state.statusText).toBe('Active in this window');
        expect(state.workspaceStatusText).toContain('Workspace browsing starts after');
    });

    test('reports motion and workspace as outside the schedule', async () => {
        const config = configWith({
            workspace: { enabled: true },
            schedule: { enabled: true, windows: [{ start: '00:00', end: '00:01' }] }
        });
        const { bot } = buildBot(config);

        await bot.start();

        const state = bot.getState();
        expect(state.statusText).toBe('Outside schedule');
        expect(state.workspaceStatusText).toBe('Workspace browsing paused: outside schedule.');
    });

    test('reports motion disabled when nothing is running', async () => {
        const { bot } = buildBot(configWith({ motion: { enabled: false } }));

        await bot.start();

        expect(bot.getState().statusText).toBe('Motion disabled');
    });

    test('reports browsing when motion is disabled but browsing is active', async () => {
        useWorkspaceWithFiles();
        const config = configWith({
            motion: { enabled: false },
            workspace: { enabled: true, idleMs: 10000 }
        });
        const { bot } = buildBot(config);

        await bot.start();
        setWallClock(at(10000));
        tick();

        const state = bot.getState();
        expect(state.statusText).toBe('Browsing workspace');
        expect(state.workspaceStatusText).toContain('Next file opens after the configured delay.');
    });

    test('reports browsing ahead of rotation when motion is enabled', async () => {
        mockVscode.workspace.workspaceFolders = [{ uri: { fsPath: '/workspace' } }];
        const config = configWith({
            workspace: { enabled: true, idleMs: 10000 }
        });
        const { bot } = buildBot(config);

        await bot.start();
        setWallClock(at(10000));
        tick();

        expect(bot.getState().statusText).toBe('Browsing workspace');
    });

    test('reports rotating once motion has started', async () => {
        const { bot } = buildBot();

        await bot.start();
        setWallClock(at(250));
        tick();

        expect(bot.getState().statusText).toBe('Rotating');
    });

    test('reports the remaining idle time before motion starts', async () => {
        const { bot } = buildBot();

        await bot.start();

        expect(bot.getState().statusText).toBe('Waiting 1s for motion');
    });

    test('reports Ready when idle time has elapsed but nothing has started', async () => {
        const { bot } = buildBot();

        await bot.start();
        setWallClock(at(1000));

        expect(bot.getState().statusText).toBe('Ready');
    });

    test('keeps the scanned workspace status once browsing is idle', async () => {
        const config = configWith({
            motion: { enabled: false },
            workspace: { enabled: true, idleMs: 10000 }
        });
        const { bot } = buildBot(config);

        await bot.start();
        setWallClock(at(10000));

        expect(bot.getState().workspaceStatusText).toBe('Workspace browsing waiting for scan.');
    });
});

describe('mouse-bot polling', () => {
    test('stops activities as soon as ownership is lost', async () => {
        const coordinator = createCoordinator();
        coordinator.owned = false;
        const { bot } = buildBot(configWith(), coordinator);

        await bot.start();
        tick();

        expect(bot.getState().running).toBe(true);
    });

    test('polls without acting when nothing is due', async () => {
        const { bot } = buildBot(configWith({ motion: { enabled: false } }));

        await bot.start();
        tick();

        expect(mockRobot.moveMouse).not.toHaveBeenCalled();
    });

    test('reports the schedule rollover only after the robot loads', async () => {
        jest.resetModules();
        const { createMouseBot: isolatedCreate } = require('../src/services/mouse-bot');
        mockRobotAvailable = false;
        const config = configWith({
            motion: { enabled: false },
            schedule: { enabled: true, windows: [{ start: '00:00', end: '23:59' }] }
        });
        const { bot, states } = buildBot(config, createCoordinator(), isolatedCreate);

        await bot.start();
        expect(mockVscode.window.showWarningMessage).toHaveBeenCalled();

        const before = states.length;
        tick();
        expect(states.length).toBe(before);

        setWallClock(new Date(2026, 4, 13, 12, 0, 0));
        tick();

        expect(states.length).toBeGreaterThan(before);
    });

    test('records the pointer position once the robot becomes available', async () => {
        jest.resetModules();
        const { createMouseBot: isolatedCreate } = require('../src/services/mouse-bot');
        mockRobotAvailable = false;
        const { bot } = buildBot(
            configWith({ motion: { enabled: false } }),
            createCoordinator(),
            isolatedCreate
        );

        await bot.start();
        mockRobotAvailable = true;
        tick();

        expect(bot.getState().running).toBe(true);
    });

    test('stops rotation when the schedule no longer allows motion', async () => {
        const config = configWith({
            schedule: { enabled: true, windows: [{ start: '00:00', end: '23:59' }] }
        });
        const { bot } = buildBot(config);

        await bot.start();
        setWallClock(at(250));
        tick();
        expect(bot.getState().statusText).toBe('Rotating');

        setWallClock(new Date(2026, 4, 12, 23, 59, 0));
        tick();

        expect(bot.getState().statusText).toBe('Outside schedule');
    });

    test('handles detected pointer movement', async () => {
        const { bot } = buildBot(configWith({ motion: { enabled: false } }));

        await bot.start();
        mockRobot.getMousePos.mockReturnValue({ x: 100, y: 100 });
        tick();

        expect(bot.getState().running).toBe(true);
    });

    test('starts browsing and rotation together when the workspace is idle', async () => {
        mockVscode.workspace.workspaceFolders = [{ uri: { fsPath: '/workspace' } }];
        const config = configWith({ workspace: { enabled: true, idleMs: 10000 } });
        const { bot } = buildBot(config);

        await bot.start();
        setWallClock(at(10000));
        tick();
        expect(bot.getState().statusText).toBe('Browsing workspace');

        tick();
        expect(bot.getState().workspaceStatusText).toContain(
            'Next file opens after the configured delay.'
        );
    });

    test('stops a pending browse step once the schedule closes', async () => {
        useWorkspaceWithFiles();
        const config = configWith({
            motion: { enabled: false },
            workspace: { enabled: true, idleMs: 10000 },
            schedule: { enabled: true, windows: [{ start: '00:00', end: '23:59' }] }
        });
        const { bot } = buildBot(config);

        await bot.start();
        setWallClock(at(10000));
        tick();
        await flushMicrotasks();

        expect(bot.getState().workspaceStatusText).toContain(
            'Next file opens after the configured delay.'
        );

        setWallClock(new Date(2026, 4, 12, 23, 59, 0));
        tick();

        expect(bot.getState().statusText).toBe('Outside schedule');
    });

    test('does not browse until the workspace idle threshold is reached', async () => {
        const config = configWith({
            motion: { idleMs: 250 },
            workspace: { enabled: true, idleMs: 60000 }
        });
        const { bot } = buildBot(config);

        await bot.start();
        setWallClock(at(300));
        tick();

        expect(bot.getState().workspaceStatusText).toContain('Workspace browsing starts after');
    });
});
