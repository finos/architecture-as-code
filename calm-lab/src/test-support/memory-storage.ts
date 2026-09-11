/**
 * In-memory implementation of the DOM Storage interface.
 *
 * Provides a fake localStorage/sessionStorage for testing environments
 * where Node's global Storage is incomplete (e.g., Node 25+).
 *
 * Framework-free and test-runner-agnostic for use in both vitest.setup.ts
 * and individual test files.
 */

/**
 * Creates an in-memory Storage object that implements the full DOM Storage interface.
 * @returns A Storage object backed by a Map<string, string>
 */
export function createMemoryStorage(): Storage {
  const store = new Map<string, string>();

  return {
    getItem(key: string): string | null {
      return store.get(key) ?? null;
    },

    setItem(key: string, value: string): void {
      store.set(key, value);
    },

    removeItem(key: string): void {
      store.delete(key);
    },

    clear(): void {
      store.clear();
    },

    key(index: number): string | null {
      if (index < 0 || index >= store.size) {
        return null;
      }
      const keys = Array.from(store.keys());
      return keys[index] ?? null;
    },

    get length(): number {
      return store.size;
    },
  };
}
