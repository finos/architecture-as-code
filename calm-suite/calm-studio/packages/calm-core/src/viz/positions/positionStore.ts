// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

export interface NodePosition {
  x: number;
  y: number;
}

export interface PositionStore {
  load: (archId: string) => Map<string, NodePosition>;
  save: (archId: string, nodeId: string, pos: NodePosition) => void;
  clear: (archId: string) => void;
}

const KEY_PREFIX = 'calm-studio:positions:';

function key(archId: string): string {
  return `${KEY_PREFIX}${archId}`;
}

export function createPositionStore(storage?: Storage): PositionStore {
  const fallback = new Map<string, Map<string, NodePosition>>();
  let quotaFailed = false;
  const useFallback = (): boolean => !storage || quotaFailed;

  const ensureFallback = (archId: string): Map<string, NodePosition> => {
    let m = fallback.get(archId);
    if (!m) {
      m = new Map();
      fallback.set(archId, m);
    }
    return m;
  };

  const load: PositionStore['load'] = (archId) => {
    if (useFallback()) return new Map(ensureFallback(archId));
    try {
      const raw = storage!.getItem(key(archId));
      if (!raw) return new Map();
      const parsed = JSON.parse(raw) as Record<string, NodePosition>;
      return new Map(Object.entries(parsed));
    } catch {
      return new Map();
    }
  };

  const writeStorage = (archId: string, positions: Map<string, NodePosition>): void => {
    try {
      storage!.setItem(key(archId), JSON.stringify(Object.fromEntries(positions)));
    } catch (err) {
      if (!quotaFailed) {
        console.warn('[positionStore] storage quota exceeded; falling back to in-memory', err);
        quotaFailed = true;
      }
    }
  };

  return {
    load,
    save: (archId, nodeId, pos) => {
      if (useFallback()) {
        ensureFallback(archId).set(nodeId, pos);
        return;
      }
      const current = load(archId);
      current.set(nodeId, pos);
      writeStorage(archId, current);
      if (quotaFailed) ensureFallback(archId).set(nodeId, pos);
    },
    clear: (archId) => {
      fallback.delete(archId);
      if (storage && !quotaFailed) {
        try {
          storage.removeItem(key(archId));
        } catch {
          /* ignore */
        }
      }
    },
  };
}
