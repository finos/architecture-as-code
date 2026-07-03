// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import type { PackDefinition, NodeTypeEntry } from './types.js';

/** Module-level registry map: pack id -> PackDefinition */
const registry = new Map<string, PackDefinition>();

/**
 * Register a pack in the registry. Re-registration with the same id overwrites.
 */
export function registerPack(pack: PackDefinition): void {
  registry.set(pack.id, pack);
}

/**
 * Resolve a colon-prefixed CALM type string to its NodeTypeEntry.
 * e.g. 'aws:lambda' -> looks up 'aws' pack, finds node with typeId 'aws:lambda'.
 * Returns null if the pack is not registered or the type is not found.
 * Unprefixed types (e.g. 'actor') always return null — core types are resolved by the canvas.
 */
export function resolvePackNode(calmType: string): NodeTypeEntry | null {
  const colonIdx = calmType.indexOf(':');
  if (colonIdx === -1) return null;
  const packId = calmType.slice(0, colonIdx);
  const pack = registry.get(packId);
  if (!pack) return null;
  return pack.nodes.find((n) => n.typeId === calmType) ?? null;
}

/**
 * Returns all currently registered packs as an array.
 */
export function getAllPacks(): PackDefinition[] {
  return [...registry.values()];
}

/**
 * Given a list of CALM type strings, returns unique pack IDs for those that are
 * colon-prefixed and whose pack is registered.
 * e.g. ['aws:lambda', 'actor', 'k8s:pod'] -> ['aws', 'k8s']
 */
export function getPacksForTypes(types: string[]): string[] {
  const seen = new Set<string>();
  for (const t of types) {
    const colonIdx = t.indexOf(':');
    if (colonIdx !== -1) {
      seen.add(t.slice(0, colonIdx));
    }
  }
  return [...seen];
}

/**
 * Clears all registered packs. Intended for use in tests.
 */
export function resetRegistry(): void {
  registry.clear();
}
