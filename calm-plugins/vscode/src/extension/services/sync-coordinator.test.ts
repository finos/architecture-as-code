import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SyncCoordinator } from './sync-coordinator';

describe('SyncCoordinator', () => {
    let sync: SyncCoordinator;

    beforeEach(() => {
        vi.useFakeTimers();
        sync = new SyncCoordinator();
    });

    afterEach(() => {
        sync.dispose();
        vi.useRealTimers();
    });

    it('allows file changes by default', () => {
        expect(sync.fileChanged()).toBe(true);
    });

    it('suppresses file changes after canvas write', () => {
        sync.canvasChanged();
        expect(sync.fileChanged()).toBe(false);
    });

    it('allows file changes after suppression window expires', () => {
        sync.canvasChanged();
        expect(sync.fileChanged()).toBe(false);
        vi.advanceTimersByTime(1100);
        expect(sync.fileChanged()).toBe(true);
    });

    it('resets suppression timer on repeated canvas writes', () => {
        sync.canvasChanged();
        vi.advanceTimersByTime(800);
        sync.canvasChanged();
        vi.advanceTimersByTime(800);
        expect(sync.fileChanged()).toBe(false);
        vi.advanceTimersByTime(300);
        expect(sync.fileChanged()).toBe(true);
    });

    it('canvasChanged always returns true', () => {
        expect(sync.canvasChanged()).toBe(true);
        expect(sync.canvasChanged()).toBe(true);
    });
});
