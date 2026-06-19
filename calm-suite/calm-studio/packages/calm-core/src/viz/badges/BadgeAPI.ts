import type { CalmArchitecture } from '../../types.js';
import type { Badge, BadgeAdapter, BadgeIndex } from './types.js';

export function createBadgeAPI(
  arch: CalmArchitecture,
  adapters: BadgeAdapter[],
): BadgeIndex {
  const nodeIndex = new Map<string, Map<string, Badge>>();
  const edgeIndex = new Map<string, Map<string, Badge>>();

  const upsert = (bucket: Map<string, Map<string, Badge>>, id: string, badges: Badge[]) => {
    if (badges.length === 0) return;
    let perId = bucket.get(id);
    if (!perId) {
      perId = new Map();
      bucket.set(id, perId);
    }
    for (const b of badges) perId.set(b.id, b);
  };

  for (const adapter of adapters) {
    for (const node of arch.nodes ?? []) {
      upsert(nodeIndex, node['unique-id'], adapter.forNode(node, arch));
    }
    for (const edge of arch.relationships ?? []) {
      upsert(edgeIndex, edge['unique-id'], adapter.forEdge(edge, arch));
    }
  }

  return {
    forNode: (id) => Array.from(nodeIndex.get(id)?.values() ?? []),
    forEdge: (id) => Array.from(edgeIndex.get(id)?.values() ?? []),
  };
}
