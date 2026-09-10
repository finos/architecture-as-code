import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { createMemoryStorage } from './src/test-support/memory-storage.js';

// Node 26 exposes a throwing localStorage global; give tests a working one.
vi.stubGlobal('localStorage', createMemoryStorage());
vi.stubGlobal('sessionStorage', createMemoryStorage());

// reactflow needs ResizeObserver
vi.stubGlobal(
    'ResizeObserver',
    class ResizeObserver {
        observe() { }
        unobserve() { }
        disconnect() { }
    },
);

afterEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
});
