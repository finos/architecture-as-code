import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { createMemoryStorage } from './src/test-support/memory-storage.js';

// Stub localStorage and sessionStorage for Node 26 compatibility
vi.stubGlobal('localStorage', createMemoryStorage());
vi.stubGlobal('sessionStorage', createMemoryStorage());

// Node.js 25+ defines a non-functional localStorage on globalThis that
// shadows jsdom's implementation. Override it with a proper Storage polyfill.
if (typeof globalThis.localStorage === 'object' && typeof globalThis.localStorage.clear !== 'function') {
    const storage = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        enumerable: true,
        value: {
            getItem: (key: string) => storage.get(key) ?? null,
            setItem: (key: string, value: string) => storage.set(key, String(value)),
            removeItem: (key: string) => storage.delete(key),
            clear: () => storage.clear(),
            get length() { return storage.size; },
            key: (index: number) => [...storage.keys()][index] ?? null,
        },
    });
}
// Polyfill ResizeObserver for ReactFlow tests
global.ResizeObserver = class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
};

// Polyfill matchMedia (not implemented in jsdom). Defaults to non-matching so
// components fall back to their desktop layout in tests. Individual tests can
// override window.matchMedia to exercise mobile/responsive behaviour.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
    window.matchMedia = (query: string) =>
        ({
            matches: false,
            media: query,
            onchange: null,
            addEventListener: () => {},
            removeEventListener: () => {},
            addListener: () => {},
            removeListener: () => {},
            dispatchEvent: () => false,
        }) as unknown as MediaQueryList;
}

// runs a clean after each test case (e.g. clearing jsdom)
afterEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
});
