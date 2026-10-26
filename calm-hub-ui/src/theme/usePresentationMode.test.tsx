import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStorage } from '../test-support/memory-storage.js';
import {
    createPresentationModeStore,
    PRESENTATION_MODE_KEY,
    presentParam,
    usePresentationMode,
} from './usePresentationMode.js';

describe('createPresentationModeStore', () => {
    it('starts off when nothing is stored', () => {
        expect(createPresentationModeStore(createMemoryStorage()).getSnapshot()).toBe(false);
    });

    it('starts on when the session kept the mode on', () => {
        const storage = createMemoryStorage();
        storage.setItem(PRESENTATION_MODE_KEY, '1');
        expect(createPresentationModeStore(storage).getSnapshot()).toBe(true);
    });

    it('keeps each change and tells the subscribers', () => {
        const storage = createMemoryStorage();
        const store = createPresentationModeStore(storage);
        const onChange = vi.fn();
        store.subscribe(onChange);

        store.set(true);
        expect(store.getSnapshot()).toBe(true);
        expect(storage.getItem(PRESENTATION_MODE_KEY)).toBe('1');

        store.set(false);
        expect(store.getSnapshot()).toBe(false);
        expect(storage.getItem(PRESENTATION_MODE_KEY)).toBe('0');
        expect(onChange).toHaveBeenCalledTimes(2);
    });

    it('does not tell the subscribers when the mode does not change', () => {
        const store = createPresentationModeStore(createMemoryStorage());
        const onChange = vi.fn();
        store.subscribe(onChange);

        store.set(false);
        expect(onChange).not.toHaveBeenCalled();
    });

    it('still changes when storage throws', () => {
        const storage = createMemoryStorage();
        vi.spyOn(storage, 'getItem').mockImplementation(() => {
            throw new DOMException('denied', 'SecurityError');
        });
        vi.spyOn(storage, 'setItem').mockImplementation(() => {
            throw new DOMException('denied', 'SecurityError');
        });
        const store = createPresentationModeStore(storage);

        expect(store.getSnapshot()).toBe(false);
        store.set(true);
        expect(store.getSnapshot()).toBe(true);
    });
});

describe('usePresentationMode', () => {
    it('follows the store', () => {
        const store = createPresentationModeStore(createMemoryStorage());
        const { result } = renderHook(() => usePresentationMode(store));
        expect(result.current.presenting).toBe(false);

        act(() => result.current.setPresenting(true));
        expect(result.current.presenting).toBe(true);
    });
});

describe('presentParam', () => {
    afterEach(() => {
        window.location.hash = '';
    });

    it('reads present from the query in the hash route', () => {
        window.location.hash = '#/finos/architectures/33/1.1.0?tab=diagram&present=1';
        expect(presentParam()).toBe(true);

        window.location.hash = '#/finos/architectures/33/1.1.0?present=0';
        expect(presentParam()).toBe(false);
    });

    it('is undefined when present is absent or has another value', () => {
        window.location.hash = '#/finos/architectures/33/1.1.0?tab=diagram';
        expect(presentParam()).toBeUndefined();

        window.location.hash = '#/finos/architectures/33/1.1.0?present=yes';
        expect(presentParam()).toBeUndefined();
    });
});
