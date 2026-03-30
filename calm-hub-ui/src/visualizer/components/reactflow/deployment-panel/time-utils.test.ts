import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    avgDuration,
    formatDateTime,
    formatDuration,
    latestByStartTime,
    relativeTime,
    sortedByStartTime,
} from './time-utils.js';

type TimedItem = {
    id: string;
    data: {
        'start-time': string;
        'end-time': string;
    };
};

describe('time-utils', () => {
    describe('formatDateTime', () => {
        it('returns em dash when iso is missing', () => {
            expect(formatDateTime()).toBe('—');
        });

        it('formats a valid ISO timestamp using locale formatting', () => {
            const iso = '2024-03-01T10:05:00Z';
            const expected = new Date(iso).toLocaleString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });

            expect(formatDateTime(iso)).toBe(expected);
        });
    });

    describe('relativeTime', () => {
        beforeEach(() => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2026-03-30T12:00:00Z'));
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('returns em dash when iso is missing', () => {
            expect(relativeTime()).toBe('—');
        });

        it('returns Today for same-day timestamps', () => {
            expect(relativeTime('2026-03-30T00:01:00Z')).toBe('Today');
        });

        it('returns Yesterday for one-day-old timestamps', () => {
            expect(relativeTime('2026-03-29T12:00:00Z')).toBe('Yesterday');
        });

        it('returns day/week/month/year buckets for older timestamps', () => {
            expect(relativeTime('2026-03-27T12:00:00Z')).toBe('3d ago');
            expect(relativeTime('2026-03-16T12:00:00Z')).toBe('2w ago');
            expect(relativeTime('2026-01-29T12:00:00Z')).toBe('2mo ago');
            expect(relativeTime('2024-03-30T12:00:00Z')).toBe('2y ago');
        });
    });

    describe('formatDuration', () => {
        it('formats sub-minute durations as seconds', () => {
            expect(formatDuration(45_000)).toBe('45s');
        });

        it('formats minute-plus durations as minutes and seconds', () => {
            expect(formatDuration(61_000)).toBe('1m 1s');
        });
    });

    describe('avgDuration', () => {
        it('returns em dash for empty collections', () => {
            expect(avgDuration([])).toBe('—');
        });

        it('returns average duration for valid ranges', () => {
            const items: TimedItem[] = [
                {
                    id: 'a',
                    data: {
                        'start-time': '2026-03-30T12:00:00Z',
                        'end-time': '2026-03-30T12:00:30Z',
                    },
                },
                {
                    id: 'b',
                    data: {
                        'start-time': '2026-03-30T12:00:00Z',
                        'end-time': '2026-03-30T12:01:30Z',
                    },
                },
            ];

            expect(avgDuration(items)).toBe('1m 0s');
        });

        it('ignores negative durations and falls back to em dash if none valid', () => {
            const items: TimedItem[] = [
                {
                    id: 'invalid',
                    data: {
                        'start-time': '2026-03-30T12:05:00Z',
                        'end-time': '2026-03-30T12:00:00Z',
                    },
                },
            ];

            expect(avgDuration(items)).toBe('—');
        });
    });

    describe('sortedByStartTime', () => {
        it('sorts by descending start-time and does not mutate input', () => {
            const items: TimedItem[] = [
                {
                    id: 'oldest',
                    data: {
                        'start-time': '2026-03-28T12:00:00Z',
                        'end-time': '2026-03-28T12:00:10Z',
                    },
                },
                {
                    id: 'newest',
                    data: {
                        'start-time': '2026-03-30T12:00:00Z',
                        'end-time': '2026-03-30T12:00:10Z',
                    },
                },
                {
                    id: 'middle',
                    data: {
                        'start-time': '2026-03-29T12:00:00Z',
                        'end-time': '2026-03-29T12:00:10Z',
                    },
                },
            ];

            const originalOrder = items.map((item) => item.id);
            const sorted = sortedByStartTime(items);

            expect(sorted.map((item) => item.id)).toEqual(['newest', 'middle', 'oldest']);
            expect(items.map((item) => item.id)).toEqual(originalOrder);
        });
    });

    describe('latestByStartTime', () => {
        it('returns undefined for empty collections', () => {
            expect(latestByStartTime([])).toBeUndefined();
        });

        it('returns the latest item by start-time', () => {
            const items: TimedItem[] = [
                {
                    id: 'first',
                    data: {
                        'start-time': '2026-03-29T12:00:00Z',
                        'end-time': '2026-03-29T12:00:10Z',
                    },
                },
                {
                    id: 'latest',
                    data: {
                        'start-time': '2026-03-30T12:00:00Z',
                        'end-time': '2026-03-30T12:00:10Z',
                    },
                },
            ];

            expect(latestByStartTime(items)?.id).toBe('latest');
        });
    });
});