import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { initialColorMode, applyColorMode, useColorMode, THEME_STORAGE_KEY } from './theme';
import { createMemoryStorage } from './test-support/memory-storage';

describe('colour mode', () => {
    beforeEach(() => {
        document.documentElement.removeAttribute('data-theme');
    });

    it('defaults to light when nothing is stored, like the docs site', () => {
        expect(initialColorMode(createMemoryStorage())).toBe('light');
    });

    it('starts from the stored choice and ignores junk values', () => {
        const storage = createMemoryStorage();
        storage.setItem(THEME_STORAGE_KEY, 'dark');
        expect(initialColorMode(storage)).toBe('dark');
        storage.setItem(THEME_STORAGE_KEY, 'sepia');
        expect(initialColorMode(storage)).toBe('light');
    });

    it('stamps data-theme on <html>', () => {
        applyColorMode('dark');
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('useColorMode toggles, persists and re-stamps the document', () => {
        const storage = createMemoryStorage();
        const { result } = renderHook(() => useColorMode(storage));
        expect(result.current.mode).toBe('light');
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');

        act(() => result.current.toggle());
        expect(result.current.mode).toBe('dark');
        expect(storage.getItem(THEME_STORAGE_KEY)).toBe('dark');
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

        act(() => result.current.toggle());
        expect(result.current.mode).toBe('light');
        expect(storage.getItem(THEME_STORAGE_KEY)).toBe('light');
    });

    it('survives a storage that throws', () => {
        const broken = {
            getItem: () => { throw new Error('denied'); },
            setItem: () => { throw new Error('denied'); },
        } as unknown as Storage;
        const { result } = renderHook(() => useColorMode(broken));
        expect(result.current.mode).toBe('light');
        act(() => result.current.toggle());
        expect(result.current.mode).toBe('dark');
    });
});
