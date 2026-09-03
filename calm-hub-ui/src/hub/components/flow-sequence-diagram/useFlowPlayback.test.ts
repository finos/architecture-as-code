/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFlowPlayback } from './useFlowPlayback.js';

describe('useFlowPlayback', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('starts at step -1 (idle)', () => {
        const { result } = renderHook(() => useFlowPlayback({ maxStep: 4 }));
        expect(result.current.step).toBe(-1);
        expect(result.current.playing).toBe(false);
        expect(result.current.isCompleted).toBe(false);
    });

    it('stepFwd advances step and stepBk reverses', () => {
        const { result } = renderHook(() => useFlowPlayback({ maxStep: 3 }));

        act(() => result.current.stepFwd());
        expect(result.current.step).toBe(0);

        act(() => result.current.stepFwd());
        expect(result.current.step).toBe(1);

        act(() => result.current.stepBk());
        expect(result.current.step).toBe(0);

        act(() => result.current.stepBk());
        expect(result.current.step).toBe(-1);

        // Must not go below the idle step
        act(() => result.current.stepBk());
        expect(result.current.step).toBe(-1);
    });

    it('stepFwd clamps at maxStep', () => {
        const { result } = renderHook(() => useFlowPlayback({ maxStep: 1 }));
        act(() => result.current.stepFwd());
        act(() => result.current.stepFwd());
        act(() => result.current.stepFwd());
        expect(result.current.step).toBe(1);
    });

    it('reset returns to -1', () => {
        const { result } = renderHook(() => useFlowPlayback({ maxStep: 3 }));
        act(() => result.current.stepFwd());
        act(() => result.current.stepFwd());
        act(() => result.current.reset());
        expect(result.current.step).toBe(-1);
    });

    it('showAll sets step to maxStep + 1 (completed)', () => {
        const { result } = renderHook(() => useFlowPlayback({ maxStep: 3 }));
        act(() => result.current.showAll());
        expect(result.current.step).toBe(4);
        expect(result.current.isCompleted).toBe(true);
    });

    it('togglePlay auto-advances through steps', () => {
        const { result } = renderHook(() => useFlowPlayback({ maxStep: 2, baseIntervalMs: 1000 }));

        act(() => result.current.togglePlay());
        expect(result.current.playing).toBe(true);

        // After 1 tick: step 0
        act(() => { vi.advanceTimersByTime(1000); });
        expect(result.current.step).toBe(0);

        // After 2 ticks: step 1
        act(() => { vi.advanceTimersByTime(1000); });
        expect(result.current.step).toBe(1);

        // After 3 ticks: step 2
        act(() => { vi.advanceTimersByTime(1000); });
        expect(result.current.step).toBe(2);

        // After 4 ticks: completed (maxStep + 1), playback stopped
        act(() => { vi.advanceTimersByTime(1000); });
        expect(result.current.step).toBe(3);
        expect(result.current.isCompleted).toBe(true);
        expect(result.current.playing).toBe(false);
    });

    it('togglePlay pauses when already playing', () => {
        const { result } = renderHook(() => useFlowPlayback({ maxStep: 5 }));
        act(() => result.current.togglePlay());
        expect(result.current.playing).toBe(true);

        act(() => result.current.togglePlay());
        expect(result.current.playing).toBe(false);
    });

    it('resets when resetDep changes', () => {
        let dep = 'a';
        const { result, rerender } = renderHook(() => useFlowPlayback({ maxStep: 3 }, dep));
        act(() => result.current.stepFwd());
        act(() => result.current.stepFwd());
        expect(result.current.step).toBe(1);

        dep = 'b';
        rerender();
        expect(result.current.step).toBe(-1);
    });

    it('speed 2 uses half the base interval', () => {
        const { result } = renderHook(() => useFlowPlayback({ maxStep: 2, baseIntervalMs: 1000 }));
        act(() => result.current.setSpeed(2));
        act(() => result.current.togglePlay());

        // At 2× speed, interval = 500ms
        act(() => { vi.advanceTimersByTime(500); });
        expect(result.current.step).toBe(0);
    });

    it('applies a speed change mid-playback', () => {
        const { result } = renderHook(() => useFlowPlayback({ maxStep: 5, baseIntervalMs: 1000 }));
        act(() => result.current.togglePlay());

        // First tick at 1× = 1000ms
        act(() => { vi.advanceTimersByTime(1000); });
        expect(result.current.step).toBe(0);

        // Speed up to 2× while still playing; the next tick must arrive after 500ms
        act(() => result.current.setSpeed(2));
        act(() => { vi.advanceTimersByTime(500); });
        expect(result.current.step).toBe(1);
        expect(result.current.playing).toBe(true);
    });
});


