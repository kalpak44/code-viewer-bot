const { createConfigStore, cloneConfig, normalizeConfig } = require('../src/config/config-store');
const {
    CONFIG_KEY,
    DEFAULT_CONFIG,
    LEGACY_WORKSPACE_EXCLUDE_GLOB,
    DEFAULT_WORKSPACE_EXCLUDE_GLOB
} = require('../src/constants');

describe('cloneConfig', () => {
    test('returns a deep copy, not a shared reference', () => {
        const copy = cloneConfig(DEFAULT_CONFIG);
        copy.motion.radius = 999;
        copy.schedule.windows[0].start = '00:00';
        expect(DEFAULT_CONFIG.motion.radius).toBe(20);
        expect(DEFAULT_CONFIG.schedule.windows[0].start).toBe('09:00');
    });
});

describe('normalizeConfig defaults', () => {
    // Every branch here guards against a stored config from an older version, so an
    // empty object has to produce something the extension can run on.
    test('an empty object yields a complete, runnable config', () => {
        const result = normalizeConfig({});
        expect(result.motion).toEqual(DEFAULT_CONFIG.motion);
        expect(result.workspace.excludeGlob).toBe(DEFAULT_WORKSPACE_EXCLUDE_GLOB);
        expect(result.schedule.windows).toEqual(DEFAULT_CONFIG.schedule.windows);
    });

    test('null and undefined are treated as empty', () => {
        expect(normalizeConfig(null).motion.idleMs).toBe(DEFAULT_CONFIG.motion.idleMs);
        expect(normalizeConfig(undefined).motion.idleMs).toBe(DEFAULT_CONFIG.motion.idleMs);
    });

    test('motion and singleInstance default on, workspace and its enabled flag default off', () => {
        const result = normalizeConfig({});
        expect(result.motion.enabled).toBe(true);
        expect(result.instanceControl.singleInstance).toBe(true);
        expect(result.workspace.enabled).toBe(false);
    });

    test('only an explicit false turns motion or singleInstance off', () => {
        expect(normalizeConfig({ motion: { enabled: false } }).motion.enabled).toBe(false);
        expect(normalizeConfig({ motion: { enabled: 0 } }).motion.enabled).toBe(true);
        expect(
            normalizeConfig({ instanceControl: { singleInstance: false } }).instanceControl
                .singleInstance
        ).toBe(false);
    });
});

describe('normalizeConfig clamping', () => {
    test.each([
        ['idleMs', 250, 3600000],
        ['radius', 1, 2000],
        ['speed', 1, 360],
        ['rotateIntervalMs', 1, 1000],
        ['pollIntervalMs', 10, 5000],
        ['tolerancePx', 0, 100]
    ])('%s is clamped to [%i, %i]', (key, min, max) => {
        expect(normalizeConfig({ motion: { [key]: -999999 } }).motion[key]).toBe(min);
        expect(normalizeConfig({ motion: { [key]: 999999999 } }).motion[key]).toBe(max);
        const mid = Math.floor((min + max) / 2);
        expect(normalizeConfig({ motion: { [key]: mid } }).motion[key]).toBe(mid);
    });

    test('a non-numeric value falls back to the default rather than NaN', () => {
        const result = normalizeConfig({ motion: { radius: 'wide', speed: null } });
        expect(result.motion.radius).toBe(DEFAULT_CONFIG.motion.radius);
        expect(result.motion.speed).toBe(DEFAULT_CONFIG.motion.speed);
    });

    test('fractional values are rounded', () => {
        expect(normalizeConfig({ motion: { radius: 20.6 } }).motion.radius).toBe(21);
    });

    test('flat legacy keys are still honoured', () => {
        expect(normalizeConfig({ idleMs: 5000, radius: 40 }).motion.idleMs).toBe(5000);
        expect(normalizeConfig({ idleMs: 5000, radius: 40 }).motion.radius).toBe(40);
    });

    test('a nested value wins over the flat legacy one', () => {
        expect(normalizeConfig({ idleMs: 5000, motion: { idleMs: 9000 } }).motion.idleMs).toBe(
            9000
        );
    });

    test('workspace intervals are clamped to their own range', () => {
        expect(normalizeConfig({ workspace: { idleMs: 1 } }).workspace.idleMs).toBe(10000);
        expect(
            normalizeConfig({ workspace: { advanceIntervalMs: 999999 } }).workspace
                .advanceIntervalMs
        ).toBe(60000);
    });

    test('randomOffsetMinutes is clamped to three hours', () => {
        expect(
            normalizeConfig({ schedule: { randomOffsetMinutes: -10 } }).schedule.randomOffsetMinutes
        ).toBe(0);
        expect(
            normalizeConfig({ schedule: { randomOffsetMinutes: 999 } }).schedule.randomOffsetMinutes
        ).toBe(180);
    });
});

describe('normalizeConfig enumerations', () => {
    test('scanMode and openMode fall back to their safe value', () => {
        expect(normalizeConfig({ workspace: { scanMode: 'extension' } }).workspace.scanMode).toBe(
            'extension'
        );
        expect(
            normalizeConfig({ workspace: { scanMode: 'anything-else' } }).workspace.scanMode
        ).toBe('popular');
        expect(normalizeConfig({ workspace: { openMode: 'new-tab' } }).workspace.openMode).toBe(
            'new-tab'
        );
        expect(normalizeConfig({ workspace: { openMode: 'nonsense' } }).workspace.openMode).toBe(
            'same-tab'
        );
    });
});

describe('normalizeConfig extensions', () => {
    test('a missing dot is added and the value lowercased', () => {
        expect(
            normalizeConfig({ workspace: { preferredExtension: 'TS' } }).workspace
                .preferredExtension
        ).toBe('.ts');
        expect(
            normalizeConfig({ workspace: { preferredExtension: '.MJS' } }).workspace
                .preferredExtension
        ).toBe('.mjs');
    });

    test('whitespace-only or non-string falls back to the default', () => {
        expect(
            normalizeConfig({ workspace: { preferredExtension: '   ' } }).workspace
                .preferredExtension
        ).toBe(DEFAULT_CONFIG.workspace.preferredExtension);
        expect(
            normalizeConfig({ workspace: { preferredExtension: 42 } }).workspace.preferredExtension
        ).toBe(DEFAULT_CONFIG.workspace.preferredExtension);
    });
});

describe('normalizeConfig exclude glob migration', () => {
    // The legacy glob did not exclude .vscode or *.code-workspace, so a config saved by
    // an older build must be migrated rather than carried forward verbatim.
    test('the legacy glob is upgraded to the current one', () => {
        expect(
            normalizeConfig({ workspace: { excludeGlob: LEGACY_WORKSPACE_EXCLUDE_GLOB } }).workspace
                .excludeGlob
        ).toBe(DEFAULT_WORKSPACE_EXCLUDE_GLOB);
    });

    test('a custom glob is preserved', () => {
        expect(
            normalizeConfig({ workspace: { excludeGlob: '**/tmp/**' } }).workspace.excludeGlob
        ).toBe('**/tmp/**');
    });

    test('an empty glob falls back to the default', () => {
        expect(normalizeConfig({ workspace: { excludeGlob: '  ' } }).workspace.excludeGlob).toBe(
            DEFAULT_WORKSPACE_EXCLUDE_GLOB
        );
    });
});

describe('normalizeConfig schedule windows', () => {
    test('windows are kept and each normalised to start and end strings', () => {
        const result = normalizeConfig({
            schedule: { windows: [{ start: '08:00', end: '12:00' }] }
        });
        expect(result.schedule.windows).toEqual([{ start: '08:00', end: '12:00' }]);
    });

    test('a non-array windows value falls back to the defaults', () => {
        expect(normalizeConfig({ schedule: { windows: 'nope' } }).schedule.windows).toEqual(
            DEFAULT_CONFIG.schedule.windows
        );
    });

    test('an empty windows array falls back to the defaults', () => {
        expect(normalizeConfig({ schedule: { windows: [] } }).schedule.windows).toEqual(
            DEFAULT_CONFIG.schedule.windows
        );
    });

    test('a window missing its ends is filled in rather than dropped', () => {
        expect(normalizeConfig({ schedule: { windows: [{}] } }).schedule.windows).toEqual([
            { start: '09:00', end: '17:00' }
        ]);
    });

    test('the returned defaults are a copy, so mutating them cannot poison DEFAULT_CONFIG', () => {
        normalizeConfig({}).schedule.windows[0].start = '03:00';
        expect(DEFAULT_CONFIG.schedule.windows[0].start).toBe('09:00');
    });
});

describe('createConfigStore', () => {
    const fakeContext = (stored) => {
        const state = { value: stored };
        return {
            globalState: {
                get: jest.fn((key, fallback) =>
                    key === CONFIG_KEY ? (state.value ?? fallback) : fallback
                ),
                update: jest.fn(async (key, value) => {
                    if (key === CONFIG_KEY) state.value = value;
                })
            },
            state
        };
    };

    test('load reads the config key and normalises what it finds', () => {
        const ctx = fakeContext({ motion: { radius: 999999 } });
        expect(createConfigStore(ctx).load().motion.radius).toBe(2000);
        expect(ctx.globalState.get).toHaveBeenCalledWith(CONFIG_KEY, DEFAULT_CONFIG);
    });

    test('load falls back to the defaults when nothing is stored', () => {
        const ctx = fakeContext(undefined);
        expect(createConfigStore(ctx).load().motion.idleMs).toBe(DEFAULT_CONFIG.motion.idleMs);
    });

    test('save persists the normalised value, not the raw one', async () => {
        const ctx = fakeContext(undefined);
        const saved = await createConfigStore(ctx).save({ motion: { radius: -50 } });
        expect(saved.motion.radius).toBe(1);
        expect(ctx.state.value.motion.radius).toBe(1);
    });

    test('save returns what a subsequent load would read back', async () => {
        const ctx = fakeContext(undefined);
        const store = createConfigStore(ctx);
        const saved = await store.save({ workspace: { preferredExtension: 'TSX' } });
        expect(store.load()).toEqual(saved);
    });
});
