let fsFiles = new Map();
let fsFailures = new Map();

const mockFs = {
    readFile: jest.fn(async (filePath) => {
        if (fsFailures.has(filePath)) {
            throw fsFailures.get(filePath);
        }
        if (!fsFiles.has(filePath)) {
            const error = new Error('ENOENT: no such file');
            error.code = 'ENOENT';
            throw error;
        }
        return fsFiles.get(filePath);
    }),
    writeFile: jest.fn(async (filePath, contents) => {
        fsFiles.set(filePath, contents);
    }),
    mkdir: jest.fn(async () => {}),
    unlink: jest.fn(async (filePath) => {
        if (!fsFiles.has(filePath)) {
            const error = new Error('ENOENT: no such file');
            error.code = 'ENOENT';
            throw error;
        }
        fsFiles.delete(filePath);
    })
};

jest.mock('node:fs/promises', () => mockFs);

const mockVscode = {
    workspace: {
        name: 'test-workspace',
        workspaceFolders: []
    }
};

jest.mock('vscode', () => mockVscode, { virtual: true });

const { createInstanceCoordinator } = require('../src/services/instance-coordinator');

const LOCK_PATH = require('node:path').join('/global-storage', 'instance-lock.json');

const enabledConfig = () => ({ instanceControl: { singleInstance: true } });
const disabledConfig = () => ({ instanceControl: { singleInstance: false } });

const createCoordinator = (overrides = {}) => {
    const onChange = jest.fn();
    const logger = jest.fn();
    const coordinator = createInstanceCoordinator({
        extensionContext: { globalStorageUri: { fsPath: '/global-storage' } },
        logger,
        initialConfig: enabledConfig(),
        onChange,
        ...overrides
    });
    return { coordinator, onChange, logger };
};

beforeEach(() => {
    fsFiles = new Map();
    fsFailures = new Map();
    mockVscode.workspace.name = 'test-workspace';
    mockVscode.workspace.workspaceFolders = [];
    jest.clearAllMocks();
});

afterEach(async () => {
    jest.useRealTimers();
});

describe('acquiring ownership', () => {
    test('writes a lease and becomes owner when no lock file exists', async () => {
        const { coordinator } = createCoordinator();
        await coordinator.start();

        expect(coordinator.isOwner()).toBe(true);
        expect(mockFs.writeFile).toHaveBeenCalledTimes(1);
        await coordinator.stop();
    });

    test('stays in standby while another instance holds a fresh lease', async () => {
        fsFiles.set(
            LOCK_PATH,
            JSON.stringify({
                instanceId: 'someone-else',
                label: 'Other window',
                updatedAt: Date.now()
            })
        );
        const { coordinator } = createCoordinator();
        await coordinator.start();

        expect(coordinator.isOwner()).toBe(false);
        expect(coordinator.getState().owner.instanceId).toBe('someone-else');
        expect(mockFs.writeFile).not.toHaveBeenCalled();
        await coordinator.stop();
    });

    test('takes over once the existing lease has expired', async () => {
        fsFiles.set(
            LOCK_PATH,
            JSON.stringify({
                instanceId: 'stale-owner',
                label: 'Stale window',
                updatedAt: Date.now() - 20000
            })
        );
        const { coordinator } = createCoordinator();
        await coordinator.start();

        expect(coordinator.isOwner()).toBe(true);
        await coordinator.stop();
    });

    test('a corrupt lock file is treated the same as no lock file', async () => {
        fsFiles.set(LOCK_PATH, 'not valid json');
        const { coordinator } = createCoordinator();
        await coordinator.start();

        expect(coordinator.isOwner()).toBe(true);
        await coordinator.stop();
    });

    test('an unreadable lock file logs the failure and still lets the instance proceed', async () => {
        const error = new Error('permission denied');
        error.code = 'EACCES';
        fsFailures.set(LOCK_PATH, error);
        const { coordinator, logger } = createCoordinator();
        await coordinator.start();

        expect(coordinator.isOwner()).toBe(true);
        expect(logger).toHaveBeenCalledWith(expect.stringContaining('Instance lock read failed'));
        await coordinator.stop();
    });

    test('valid JSON that is not a lease shape is treated as no lock file', async () => {
        fsFiles.set(LOCK_PATH, JSON.stringify({ unrelated: true }));
        const { coordinator } = createCoordinator();
        await coordinator.start();

        expect(coordinator.isOwner()).toBe(true);
        await coordinator.stop();
    });

    test('an unexpected failure acquiring ownership is logged, not thrown', async () => {
        const error = new Error('disk full');
        mockFs.mkdir.mockRejectedValueOnce(error);
        const { coordinator, logger } = createCoordinator();

        await expect(coordinator.start()).resolves.toBeUndefined();
        expect(logger).toHaveBeenCalledWith(
            expect.stringContaining('Instance coordination failed: disk full')
        );
        await coordinator.stop();
    });
});

describe('the heartbeat', () => {
    test('re-affirming its own lease does not re-fire onChange or re-log acquisition', async () => {
        const { coordinator, onChange, logger } = createCoordinator();
        await coordinator.start();

        onChange.mockClear();
        logger.mockClear();

        await coordinator.refreshOwnership();

        expect(coordinator.isOwner()).toBe(true);
        expect(onChange).not.toHaveBeenCalled();
        expect(logger).not.toHaveBeenCalled();
        await coordinator.stop();
    });

    test('losing the lease to a takeover fires onChange exactly once', async () => {
        const { coordinator, onChange } = createCoordinator();
        await coordinator.start();
        onChange.mockClear();

        fsFiles.set(
            LOCK_PATH,
            JSON.stringify({
                instanceId: 'new-owner',
                label: 'New window',
                updatedAt: Date.now()
            })
        );
        await coordinator.refreshOwnership();

        expect(coordinator.isOwner()).toBe(false);
        expect(onChange).toHaveBeenCalledTimes(1);
        await coordinator.stop();
    });

    test('runs on an interval while started, and stops once stopped', async () => {
        jest.useFakeTimers();
        const { coordinator } = createCoordinator();
        await coordinator.start();

        const writesAfterStart = mockFs.writeFile.mock.calls.length;
        await jest.advanceTimersByTimeAsync(4000);
        expect(mockFs.writeFile.mock.calls.length).toBeGreaterThan(writesAfterStart);

        await coordinator.stop();
        const writesAfterStop = mockFs.writeFile.mock.calls.length;
        await jest.advanceTimersByTimeAsync(8000);
        expect(mockFs.writeFile.mock.calls.length).toBe(writesAfterStop);
    });

    test('starting twice without stopping replaces the old heartbeat instead of doubling it', async () => {
        jest.useFakeTimers();
        const { coordinator } = createCoordinator();
        await coordinator.start();
        await coordinator.start();

        const writesBeforeTick = mockFs.writeFile.mock.calls.length;
        await jest.advanceTimersByTimeAsync(4000);

        // A second, un-cleared interval would have written twice on this one tick.
        expect(mockFs.writeFile.mock.calls.length).toBe(writesBeforeTick + 1);
        await coordinator.stop();
    });
});

describe('releasing ownership', () => {
    test('removes the lock file it owns when stopped', async () => {
        const { coordinator } = createCoordinator();
        await coordinator.start();
        expect(fsFiles.has(LOCK_PATH)).toBe(true);

        await coordinator.stop();
        expect(fsFiles.has(LOCK_PATH)).toBe(false);
        expect(coordinator.isOwner()).toBe(false);
    });

    test('an unlink failure other than ENOENT is logged, not thrown', async () => {
        const { coordinator, logger } = createCoordinator();
        await coordinator.start();

        const error = new Error('permission denied');
        error.code = 'EACCES';
        mockFs.unlink.mockRejectedValueOnce(error);

        await expect(coordinator.stop()).resolves.toBeUndefined();
        expect(logger).toHaveBeenCalledWith(
            expect.stringContaining('Instance lock release failed: permission denied')
        );
        expect(coordinator.isOwner()).toBe(false);
    });

    test('does not remove a lock file someone else now owns', async () => {
        const { coordinator } = createCoordinator();
        await coordinator.start();

        fsFiles.set(
            LOCK_PATH,
            JSON.stringify({
                instanceId: 'took-over',
                label: 'Other window',
                updatedAt: Date.now()
            })
        );
        await coordinator.stop();

        expect(mockFs.unlink).not.toHaveBeenCalled();
        expect(fsFiles.has(LOCK_PATH)).toBe(true);
    });

    test('stopping without ever having acquired ownership does not throw', async () => {
        fsFiles.set(
            LOCK_PATH,
            JSON.stringify({
                instanceId: 'someone-else',
                label: 'Other window',
                updatedAt: Date.now()
            })
        );
        const { coordinator } = createCoordinator();
        await coordinator.start();
        await expect(coordinator.stop()).resolves.toBeUndefined();
    });

    test('stopping before start was ever called does not throw', async () => {
        const { coordinator } = createCoordinator();
        await expect(coordinator.stop()).resolves.toBeUndefined();
    });

    test('a lock file deleted by someone else between read and unlink is not an error', async () => {
        const { coordinator, logger } = createCoordinator();
        await coordinator.start();

        const error = new Error('no such file');
        error.code = 'ENOENT';
        mockFs.unlink.mockRejectedValueOnce(error);

        await expect(coordinator.stop()).resolves.toBeUndefined();
        expect(logger).not.toHaveBeenCalledWith(
            expect.stringContaining('Instance lock release failed')
        );
    });
});

describe('single-instance control disabled', () => {
    test('claims ownership immediately, with no lock file access at all', async () => {
        const { coordinator } = createCoordinator({ initialConfig: disabledConfig() });
        await coordinator.start();

        expect(coordinator.isOwner()).toBe(true);
        expect(coordinator.getState().owner.singleInstanceDisabled).toBe(true);
        expect(mockFs.readFile).not.toHaveBeenCalled();
        expect(mockFs.writeFile).not.toHaveBeenCalled();
        await coordinator.stop();
    });

    test('enabling it switches to real lease coordination', async () => {
        const { coordinator } = createCoordinator({ initialConfig: disabledConfig() });
        await coordinator.start();

        await coordinator.updateConfig(enabledConfig());

        expect(coordinator.isOwner()).toBe(true);
        expect(mockFs.writeFile).toHaveBeenCalledTimes(1);
        expect(coordinator.getState().owner.singleInstanceDisabled).toBeUndefined();
        await coordinator.stop();
    });

    test('disabling it releases any held lease and self-claims', async () => {
        const { coordinator } = createCoordinator();
        await coordinator.start();
        expect(fsFiles.has(LOCK_PATH)).toBe(true);

        await coordinator.updateConfig(disabledConfig());

        expect(fsFiles.has(LOCK_PATH)).toBe(false);
        expect(coordinator.isOwner()).toBe(true);
        expect(coordinator.getState().owner.singleInstanceDisabled).toBe(true);
        await coordinator.stop();
    });

    test('toggling to the same value is a no-op', async () => {
        const { coordinator } = createCoordinator();
        await coordinator.start();
        const writesAfterStart = mockFs.writeFile.mock.calls.length;

        await coordinator.updateConfig(enabledConfig());

        expect(mockFs.writeFile.mock.calls.length).toBe(writesAfterStart);
        await coordinator.stop();
    });
});

describe('getState', () => {
    test('exposes this instance identity independent of ownership', async () => {
        const { coordinator } = createCoordinator();
        const beforeStart = coordinator.getState();
        expect(beforeStart.current.instanceId).toEqual(expect.any(String));
        expect(beforeStart.current.label).toContain('test-workspace');

        await coordinator.start();
        expect(coordinator.getState().current.instanceId).toBe(beforeStart.current.instanceId);
        await coordinator.stop();
    });

    test('two coordinators draw different instance ids', () => {
        const { coordinator: first } = createCoordinator();
        const { coordinator: second } = createCoordinator();
        expect(first.getState().current.instanceId).not.toBe(second.getState().current.instanceId);
    });
});

describe('handoff between two instances', () => {
    test('a standby window takes over within one heartbeat after the owner cleanly stops', async () => {
        jest.useFakeTimers();
        const { coordinator: a } = createCoordinator();
        const { coordinator: b } = createCoordinator();

        await a.start();
        expect(a.isOwner()).toBe(true);

        await b.start();
        expect(b.isOwner()).toBe(false);

        await a.stop();
        expect(fsFiles.has(LOCK_PATH)).toBe(false);

        await jest.advanceTimersByTimeAsync(4000);
        expect(b.isOwner()).toBe(true);

        await b.stop();
    });

    test('a standby window waits out the full lease timeout if the owner vanishes without releasing', async () => {
        jest.useFakeTimers();
        const { coordinator: a } = createCoordinator();
        const { coordinator: b } = createCoordinator();

        // Models a crash: one successful heartbeat write, then the process is gone — no
        // further heartbeats, and no release.
        await a.refreshOwnership();
        expect(a.isOwner()).toBe(true);

        await b.start();
        expect(b.isOwner()).toBe(false);

        await jest.advanceTimersByTimeAsync(8000);
        expect(b.isOwner()).toBe(false);

        await jest.advanceTimersByTimeAsync(8000);
        expect(b.isOwner()).toBe(true);

        await b.stop();
    });
});

describe('the instance label', () => {
    test('falls back to the first workspace folder name when no workspace name is set', () => {
        mockVscode.workspace.name = undefined;
        mockVscode.workspace.workspaceFolders = [{ uri: { fsPath: '/repos/my-project' } }];

        const { coordinator } = createCoordinator();
        expect(coordinator.getState().current.label).toContain('my-project');
    });

    test('falls back to "No Workspace" when no workspace is open at all', () => {
        mockVscode.workspace.name = undefined;
        mockVscode.workspace.workspaceFolders = [];

        const { coordinator } = createCoordinator();
        expect(coordinator.getState().current.label).toContain('No Workspace');
    });
});
