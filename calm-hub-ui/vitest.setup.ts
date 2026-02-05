import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

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

// runs a clean after each test case (e.g. clearing jsdom)
afterEach(() => {
    cleanup();
});
