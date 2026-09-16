const { createScheduleService } = require('../src/services/schedule-service');
const { normalizeConfig } = require('../src/config/config-store');

const configWith = (schedule) => normalizeConfig({ schedule });
const at = (h, m) => new Date(2026, 4, 12, h, m);

const build = (schedule) => {
    const logs = [];
    const service = createScheduleService({ logger: (line) => logs.push(line) });
    service.setConfig(configWith(schedule));
    return { service, logs };
};

describe('when the schedule is disabled', () => {
    test('every time of day is allowed', () => {
        const { service } = build({ enabled: false });
        expect(service.isWithinAllowedTime(at(3, 0))).toBe(true);
        expect(service.isWithinAllowedTime(at(12, 0))).toBe(true);
        expect(service.isWithinAllowedTime(at(23, 59))).toBe(true);
    });

    test('no schedule is built and the summary is empty', () => {
        const { service, logs } = build({ enabled: false });
        expect(service.ensureDailySchedule(at(9, 0))).toBe(false);
        expect(service.getSummary()).toEqual({ dateKey: null, windows: [] });
        expect(logs).toEqual([]);
    });

    test('an unconfigured service still allows motion rather than blocking it', () => {
        const service = createScheduleService({ logger: () => {} });
        expect(service.isWithinAllowedTime(at(12, 0))).toBe(true);
        expect(service.getSummary()).toEqual({ dateKey: null, windows: [] });
    });
});

describe('daily schedule construction', () => {
    const fixed = {
        enabled: true,
        randomOffsetMinutes: 0,
        windows: [{ start: '09:00', end: '17:00' }]
    };

    test('it is built once per day and reused', () => {
        const { service } = build(fixed);
        expect(service.ensureDailySchedule(at(9, 0))).toBe(true);
        expect(service.ensureDailySchedule(at(15, 0))).toBe(false);
    });

    test('a new date rebuilds it', () => {
        const { service } = build(fixed);
        service.ensureDailySchedule(at(9, 0));
        expect(service.ensureDailySchedule(new Date(2026, 4, 13, 9, 0))).toBe(true);
    });

    test('changing the config discards the day already built', () => {
        const { service } = build(fixed);
        service.ensureDailySchedule(at(9, 0));
        service.setConfig(configWith(fixed));
        expect(service.ensureDailySchedule(at(9, 0))).toBe(true);
    });

    // getSummary() ensures for `new Date()`, never for the date last built, so it
    // always reports today. Asserting a fixed date here would pass only on that day.
    test('the summary reports today and the window texts', () => {
        const { getDateKey } = require('../src/utils/time');
        const { service } = build(fixed);
        const summary = service.getSummary();
        expect(summary.dateKey).toBe(getDateKey());
        expect(summary.windows).toEqual([{ start: '09:00', end: '17:00' }]);
    });

    test('every window is logged once when the day is built', () => {
        const { service, logs } = build({
            enabled: true,
            randomOffsetMinutes: 0,
            windows: [
                { start: '09:00', end: '13:00' },
                { start: '14:00', end: '18:00' }
            ]
        });
        service.ensureDailySchedule(at(9, 0));
        expect(logs[0]).toContain('2026-05-12');
        expect(logs.filter((line) => line.startsWith('- '))).toHaveLength(2);
    });
});

describe('allowed-time boundaries with no random offset', () => {
    const fixed = {
        enabled: true,
        randomOffsetMinutes: 0,
        windows: [{ start: '09:00', end: '17:00' }]
    };

    test('the start is inclusive and the end exclusive', () => {
        const { service } = build(fixed);
        expect(service.isWithinAllowedTime(at(9, 0))).toBe(true);
        expect(service.isWithinAllowedTime(at(16, 59))).toBe(true);
        expect(service.isWithinAllowedTime(at(17, 0))).toBe(false);
    });

    test('outside the window is refused', () => {
        const { service } = build(fixed);
        expect(service.isWithinAllowedTime(at(8, 59))).toBe(false);
        expect(service.isWithinAllowedTime(at(23, 0))).toBe(false);
    });

    test('a gap between two windows is refused', () => {
        const { service } = build({
            enabled: true,
            randomOffsetMinutes: 0,
            windows: [
                { start: '09:00', end: '13:00' },
                { start: '14:00', end: '18:00' }
            ]
        });
        expect(service.isWithinAllowedTime(at(12, 0))).toBe(true);
        expect(service.isWithinAllowedTime(at(13, 30))).toBe(false);
        expect(service.isWithinAllowedTime(at(15, 0))).toBe(true);
    });
});

describe('random offset', () => {
    test('windows stay inside the day and keep end after start', () => {
        for (let i = 0; i < 200; i += 1) {
            const { service } = build({
                enabled: true,
                randomOffsetMinutes: 180,
                windows: [
                    { start: '00:10', end: '23:50' },
                    { start: '09:00', end: '09:05' }
                ]
            });
            service.ensureDailySchedule(at(12, 0));
            for (const window of service.getSummary().windows) {
                expect(window.start >= '00:00').toBe(true);
                expect(window.end <= '23:59').toBe(true);
                expect(window.end > window.start).toBe(true);
            }
        }
    });

    // A negative offset on the end can drag it past the start; without the guard the
    // window would be empty and the bot would never run that day.
    test('an end pushed before the start is widened, never left inverted', () => {
        for (let i = 0; i < 200; i += 1) {
            const { service } = build({
                enabled: true,
                randomOffsetMinutes: 60,
                windows: [{ start: '12:00', end: '12:01' }]
            });
            service.ensureDailySchedule(at(12, 0));
            const [window] = service.getSummary().windows;
            expect(window.end > window.start).toBe(true);
        }
    });

    test('a zero offset produces exactly the configured times', () => {
        const { service } = build({
            enabled: true,
            randomOffsetMinutes: 0,
            windows: [{ start: '10:15', end: '11:45' }]
        });
        service.ensureDailySchedule(at(10, 0));
        expect(service.getSummary().windows).toEqual([{ start: '10:15', end: '11:45' }]);
    });
});
