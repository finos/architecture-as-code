import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryStorage } from '../test-support/memory-storage.js';
import {
    createDiagramTextScaleStore,
    DIAGRAM_TEXT_SCALE_KEY,
    scalePx,
    useDiagramTextScale,
} from './useDiagramTextScale.js';

function storeAt(stored: string) {
    const storage = createMemoryStorage();
    storage.setItem(DIAGRAM_TEXT_SCALE_KEY, stored);
    return createDiagramTextScaleStore(storage);
}

describe('createDiagramTextScaleStore', () => {
    it('starts at 1 when nothing is stored', () => {
        expect(createDiagramTextScaleStore(createMemoryStorage()).getSnapshot()).toBe(1);
    });

    it.each([0.7, 0.8, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2])('starts at the stored step %d', (step) => {
        expect(storeAt(String(step)).getSnapshot()).toBe(step);
    });

    it.each(['abc', '7', '1.2', ''])('starts at 1 when the stored value is %j', (stored) => {
        expect(storeAt(stored).getSnapshot()).toBe(1);
    });

    it('starts at 1 when storage throws', () => {
        const storage = createMemoryStorage();
        storage.getItem = () => {
            throw new Error('blocked');
        };
        expect(createDiagramTextScaleStore(storage).getSnapshot()).toBe(1);
    });

    it('starts at 1 and still steps when the storage global itself throws', () => {
        const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
        Object.defineProperty(globalThis, 'localStorage', {
            configurable: true,
            get() {
                throw new DOMException('blocked', 'SecurityError');
            },
        });
        try {
            const store = createDiagramTextScaleStore();
            expect(store.getSnapshot()).toBe(1);
            store.step(1);
            expect(store.getSnapshot()).toBe(1.15);
        } finally {
            Object.defineProperty(globalThis, 'localStorage', original!);
        }
    });

    it('steps up, keeps the step and tells the subscribers', () => {
        const storage = createMemoryStorage();
        const store = createDiagramTextScaleStore(storage);
        const onChange = vi.fn();
        store.subscribe(onChange);

        store.step(1);

        expect(store.getSnapshot()).toBe(1.15);
        expect(storage.getItem(DIAGRAM_TEXT_SCALE_KEY)).toBe('1.15');
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('still steps when storage cannot keep the step', () => {
        const storage = createMemoryStorage();
        storage.setItem = () => {
            throw new Error('blocked');
        };
        const store = createDiagramTextScaleStore(storage);

        store.step(1);

        expect(store.getSnapshot()).toBe(1.15);
    });

    it('does not go past the largest or the smallest step', () => {
        const largest = storeAt('2');
        const smallest = storeAt('0.7');
        const onChange = vi.fn();
        largest.subscribe(onChange);
        smallest.subscribe(onChange);

        largest.step(1);
        smallest.step(-1);

        expect(largest.getSnapshot()).toBe(2);
        expect(smallest.getSnapshot()).toBe(0.7);
        expect(onChange).not.toHaveBeenCalled();
    });
});

describe('useDiagramTextScale', () => {
    it('cannot shrink at the smallest step', () => {
        const { result } = renderHook(() => useDiagramTextScale(storeAt('0.7')));
        expect(result.current.canShrink).toBe(false);
        expect(result.current.canGrow).toBe(true);
    });

    it('cannot grow at the largest step', () => {
        const { result } = renderHook(() => useDiagramTextScale(storeAt('2')));
        expect(result.current.canGrow).toBe(false);
        expect(result.current.canShrink).toBe(true);
    });

    it('grows and shrinks one step at a time', () => {
        const store = createDiagramTextScaleStore(createMemoryStorage());
        const { result } = renderHook(() => useDiagramTextScale(store));

        act(() => result.current.grow());
        expect(result.current.scale).toBe(1.15);

        act(() => result.current.shrink());
        act(() => result.current.shrink());
        expect(result.current.scale).toBe(0.9);
    });
});

describe('scalePx', () => {
    it.each([
        [14, 1, '14px'],
        [14, 1.15, '16.1px'],
        [24, 1.5, '36px'],
        [11, 0.9, '9.9px'],
    ])('scales %dpx by %d to %s', (px, scale, expected) => {
        expect(scalePx(px, scale)).toBe(expected);
    });
});
