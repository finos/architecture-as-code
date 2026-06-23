import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Polyfill ResizeObserver for ReactFlow tests
global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
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
});
