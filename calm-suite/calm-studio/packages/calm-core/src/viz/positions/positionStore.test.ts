// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach } from 'vitest';
import { createPositionStore } from './positionStore.js';

class MemStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }
  key(i: number): string | null {
    return Array.from(this.map.keys())[i] ?? null;
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v);
  }
}

describe('createPositionStore', () => {
  let storage: MemStorage;
  let store: ReturnType<typeof createPositionStore>;
  const archId = 'arch-a';

  beforeEach(() => {
    storage = new MemStorage();
    store = createPositionStore(storage);
  });

  it('save then load round-trips positions', () => {
    store.save(archId, 'n1', { x: 100, y: 200 });
    store.save(archId, 'n2', { x: 300, y: 400 });
    const loaded = store.load(archId);
    expect(loaded.get('n1')).toEqual({ x: 100, y: 200 });
    expect(loaded.get('n2')).toEqual({ x: 300, y: 400 });
  });

  it('load returns empty map for unknown arch', () => {
    expect(store.load('not-saved').size).toBe(0);
  });

  it('clear wipes positions for arch', () => {
    store.save(archId, 'n1', { x: 1, y: 1 });
    store.clear(archId);
    expect(store.load(archId).size).toBe(0);
  });

  it('different archs are isolated', () => {
    store.save('a', 'n', { x: 1, y: 1 });
    store.save('b', 'n', { x: 2, y: 2 });
    expect(store.load('a').get('n')).toEqual({ x: 1, y: 1 });
    expect(store.load('b').get('n')).toEqual({ x: 2, y: 2 });
  });

  it('quota exceeded falls back to in-memory map', () => {
    const quotaStorage = new MemStorage();
    quotaStorage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    const s = createPositionStore(quotaStorage);
    s.save('a', 'n', { x: 1, y: 1 });
    expect(s.load('a').get('n')).toEqual({ x: 1, y: 1 });
  });

  it('works without storage (SSR fallback)', () => {
    const s = createPositionStore(undefined);
    s.save('a', 'n', { x: 5, y: 6 });
    expect(s.load('a').get('n')).toEqual({ x: 5, y: 6 });
  });
});
