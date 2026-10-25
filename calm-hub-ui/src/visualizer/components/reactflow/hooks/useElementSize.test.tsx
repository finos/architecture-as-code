import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useElementSize } from './useElementSize.js';
import { mockOffsetSize } from '../../../../test-support/layout-mocks.js';

describe('useElementSize', () => {
    // The shared setup stubs ResizeObserver as a no-op. Swap in one that records its callback, so a resize can be
    // simulated. Globals are restored by hand, as in ArchitectureGraph.test.tsx.
    let triggerResize: (() => void) | null;
    let disconnect: ReturnType<typeof vi.fn>;
    let originalResizeObserver: typeof globalThis.ResizeObserver;

    beforeEach(() => {
        triggerResize = null;
        disconnect = vi.fn();
        originalResizeObserver = globalThis.ResizeObserver;
        globalThis.ResizeObserver = class {
            constructor(callback: ResizeObserverCallback) {
                triggerResize = () => callback([], this as unknown as ResizeObserver);
            }
            observe() {}
            unobserve() {}
            disconnect = disconnect;
        } as unknown as typeof globalThis.ResizeObserver;
    });

    afterEach(() => {
        globalThis.ResizeObserver = originalResizeObserver;
        vi.restoreAllMocks();
    });

    it('is undefined with no element', () => {
        const { result } = renderHook(() => useElementSize(null));
        expect(result.current).toBeUndefined();
        expect(triggerResize).toBeNull();
    });

    it('measures the element, and again when it resizes', () => {
        mockOffsetSize(40, 20);
        const element = document.createElement('div');
        const { result } = renderHook(() => useElementSize(element));
        expect(result.current).toEqual({ width: 40, height: 20 });

        mockOffsetSize(40, 36);
        act(() => triggerResize?.());
        expect(result.current).toEqual({ width: 40, height: 36 });
    });

    it('keeps the same size object while the size does not change', () => {
        mockOffsetSize(40, 20);
        const element = document.createElement('div');
        const { result } = renderHook(() => useElementSize(element));
        const first = result.current;
        act(() => triggerResize?.());
        expect(result.current).toBe(first);
    });

    it('is undefined for an element not laid out yet', () => {
        const element = document.createElement('div');
        const { result } = renderHook(() => useElementSize(element));
        expect(result.current).toBeUndefined();
    });

    it('stops observing when the element goes', () => {
        mockOffsetSize(40, 20);
        const { result, rerender } = renderHook(({ element }) => useElementSize(element), {
            initialProps: { element: document.createElement('div') as HTMLElement | null },
        });
        rerender({ element: null });
        expect(disconnect).toHaveBeenCalled();
        expect(result.current).toBeUndefined();
    });
});
