const { distance, randomInt } = require('../src/utils/math');
const { parseTimeToMinutes, formatMinutes, getDateKey } = require('../src/utils/time');

describe('distance', () => {
    test('measures a 3-4-5 triangle', () => {
        expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    });

    test('is zero for the same point and never negative', () => {
        expect(distance({ x: 7, y: -2 }, { x: 7, y: -2 })).toBe(0);
        expect(distance({ x: 5, y: 5 }, { x: -5, y: -5 })).toBeGreaterThan(0);
    });

    test('is symmetric', () => {
        const a = { x: 1, y: 9 };
        const b = { x: -4, y: 2 };
        expect(distance(a, b)).toBeCloseTo(distance(b, a), 10);
    });
});

describe('randomInt', () => {
    test('stays within the inclusive bounds', () => {
        for (let i = 0; i < 500; i += 1) {
            const value = randomInt(-5, 5);
            expect(value).toBeGreaterThanOrEqual(-5);
            expect(value).toBeLessThanOrEqual(5);
            expect(Number.isInteger(value)).toBe(true);
        }
    });

    test('can reach both ends of the range', () => {
        const seen = new Set();
        for (let i = 0; i < 500; i += 1) {
            seen.add(randomInt(0, 1));
        }
        expect([...seen].sort()).toEqual([0, 1]);
    });

    test('a zero-width range is a constant', () => {
        expect(randomInt(4, 4)).toBe(4);
    });
});

describe('parseTimeToMinutes', () => {
    test('converts HH:MM to minutes past midnight', () => {
        expect(parseTimeToMinutes('00:00')).toBe(0);
        expect(parseTimeToMinutes('09:30')).toBe(570);
        expect(parseTimeToMinutes('23:59')).toBe(1439);
    });

    // A stored config can hold anything; falling back to 0 keeps a bad value from
    // producing NaN window bounds that compare false against every current time.
    test('anything unparseable falls back to zero', () => {
        expect(parseTimeToMinutes('nonsense')).toBe(0);
        expect(parseTimeToMinutes('')).toBe(0);
        expect(parseTimeToMinutes(null)).toBe(0);
        expect(parseTimeToMinutes(undefined)).toBe(0);
        expect(parseTimeToMinutes('12:xx')).toBe(0);
    });

    test('a bare hour with no minutes is not NaN', () => {
        expect(Number.isFinite(parseTimeToMinutes('12'))).toBe(true);
    });
});

describe('formatMinutes', () => {
    test('renders zero-padded HH:MM', () => {
        expect(formatMinutes(0)).toBe('00:00');
        expect(formatMinutes(570)).toBe('09:30');
        expect(formatMinutes(1439)).toBe('23:59');
    });

    test('clamps below zero and above the end of the day', () => {
        expect(formatMinutes(-120)).toBe('00:00');
        expect(formatMinutes(99999)).toBe('23:59');
    });

    test('round-trips with parseTimeToMinutes', () => {
        for (const text of ['00:00', '07:05', '12:00', '23:59']) {
            expect(formatMinutes(parseTimeToMinutes(text))).toBe(text);
        }
    });
});

describe('getDateKey', () => {
    test('is local YYYY-MM-DD, zero padded', () => {
        expect(getDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
        expect(getDateKey(new Date(2026, 11, 31))).toBe('2026-12-31');
    });

    // Built from local getters, not toISOString, so an evening in a positive-offset
    // zone must not report tomorrow.
    test('uses local date parts rather than UTC', () => {
        expect(getDateKey(new Date(2026, 4, 12, 23, 30))).toBe('2026-05-12');
        expect(getDateKey(new Date(2026, 4, 12, 0, 30))).toBe('2026-05-12');
    });

    test('defaults to today', () => {
        expect(getDateKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
});
