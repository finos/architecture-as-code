import { vi } from 'vitest';

// Stub localStorage and sessionStorage for Node 26 compatibility.
// Node 26 ships global localStorage/sessionStorage that shadow jsdom's
// implementation. vi.stubGlobal overrides them with a working in-memory fake.

function createMemoryStorage(): Storage {
    const store = new Map<string, string>();
    return {
        getItem: (key) => store.get(key) ?? null,
        setItem: (key, value) => { store.set(key, value); },
        removeItem: (key) => { store.delete(key); },
        clear: () => { store.clear(); },
        key: (index) => {
            if (index < 0 || index >= store.size) return null;
            return Array.from(store.keys())[index] ?? null;
        },
        get length() { return store.size; },
    };
}

vi.stubGlobal('localStorage', createMemoryStorage());
vi.stubGlobal('sessionStorage', createMemoryStorage());
