// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import {
  getConnectsEndpoints,
  getContainerAndNodes,
  getActorAndNodes,
  getRelationshipVariant,
  type CalmRelationship,
} from '@calmstudio/calm-core';

/**
 * A single renderable edge derived from a CALM relationship. One relationship
 * can expand into zero, one, or many edges depending on its variant (e.g. an
 * `interacts` relationship with N nodes expands into N edges).
 */
export interface DiagramEdge {
  /** Unique render id for ELK/SVG (suffixed `__${index}` when a relationship fans out). */
  id: string;
  /** The source relationship's `unique-id` — what flows reference. Identity survives fan-out. */
  relationshipId: string;
  source: string;
  target: string;
  variant: string;
}

/** True when `rel` uses the legacy flat CalmStudio shape (never valid CALM). */
export function isFlatRelationship(
  rel: CalmRelationship
): rel is CalmRelationship & { source: string; destination: string } {
  const raw = rel as unknown as Record<string, unknown>;
  return (
    typeof raw['relationship-type'] === 'string' &&
    typeof raw.source === 'string' &&
    typeof raw.destination === 'string'
  );
}

/**
 * Expand a CALM relationship into zero or more diagram edges.
 *
 * Handles both the canonical nested `relationship-type` object (connects,
 * interacts, composed-of, deployed-in, options) and the legacy flat
 * CalmStudio shape as a fallback. Defensive: any edge with a missing
 * endpoint id is skipped rather than emitted with an undefined id, since
 * ELK crashes or produces garbage on undefined node references.
 *
 * @param rel - The CALM relationship to expand
 * @returns Array of diagram edges (possibly empty)
 */
export function relationshipToEdges(rel: CalmRelationship): DiagramEdge[] {
  const uid = rel['unique-id'];

  if (isFlatRelationship(rel)) {
    const raw = rel as unknown as Record<string, unknown>;
    const variant = raw['relationship-type'] as string;
    if (!rel.source || !rel.destination) return [];
    return [{ id: uid, relationshipId: uid, source: rel.source, target: rel.destination, variant }];
  }

  const rt = rel['relationship-type'];
  const variant = getRelationshipVariant(rt);

  switch (variant) {
    case 'connects': {
      const endpoints = getConnectsEndpoints(rel);
      if (!endpoints || !endpoints.source || !endpoints.destination) return [];
      return [{ id: uid, relationshipId: uid, source: endpoints.source, target: endpoints.destination, variant }];
    }
    case 'interacts': {
      const actorAndNodes = getActorAndNodes(rel);
      if (!actorAndNodes || !actorAndNodes.actor) return [];
      return buildFanOutEdges(uid, actorAndNodes.actor, actorAndNodes.nodes, variant);
    }
    case 'composed-of':
    case 'deployed-in': {
      const containerAndNodes = getContainerAndNodes(rel);
      if (!containerAndNodes || !containerAndNodes.container) return [];
      return buildFanOutEdges(uid, containerAndNodes.container, containerAndNodes.nodes, variant);
    }
    case 'options':
    default:
      return [];
  }
}

/**
 * Build one edge per target node from a single source (actor/container).
 * Uses the plain `uid` when there is exactly one target node (preserving
 * flow-overlay matching against `relationship-unique-id`), else suffixes
 * with `__${index}` for each node.
 */
function buildFanOutEdges(
  uid: string,
  source: string,
  nodes: string[],
  variant: string
): DiagramEdge[] {
  const validNodes = (nodes ?? []).filter((n): n is string => typeof n === 'string' && n.length > 0);
  if (validNodes.length === 0) return [];
  const [firstNode] = validNodes;
  if (validNodes.length === 1 && firstNode !== undefined) {
    return [{ id: uid, relationshipId: uid, source, target: firstNode, variant }];
  }
  return validNodes.map((target, index) => ({
    id: `${uid}__${index}`,
    relationshipId: uid,
    source,
    target,
    variant,
  }));
}

/** `base`, or `base_2`, `base_3`, … when taken. The result is added to `taken`. */
export function freeId(base: string, taken: Set<string>): string {
  let candidate = base;
  for (let n = 2; taken.has(candidate); n++) candidate = `${base}_${n}`;
  taken.add(candidate);
  return candidate;
}

/**
 * Connects edges to the drawings of nodes that are nested in several containers.
 * A node drawn once connects to every copy of the other end. When both ends
 * have copies, only the copies that share the most containers connect, e.g. two
 * services in the same cluster, and if no copies share a container, one edge
 * connects the first drawings. When one end contains drawings of the other, only
 * those drawings connect.
 */
export function expandEdgesToInstances(
  edges: DiagramEdge[],
  instancesOf: Map<string, string[]>,
  ancestorsOf: Map<string, string[]>
): DiagramEdge[] {
  const takenIds = new Set(edges.map((e) => e.id));
  const copyEdgeId = (id: string, i: number): string => freeId(`${id}__copy${i}`, takenIds);
  const ancestors = (id: string): string[] => ancestorsOf.get(id) ?? [];
  const contains = (outer: string, inner: string): boolean => ancestors(inner).includes(outer);

  return edges.flatMap((edge) => {
    const sources = instancesOf.get(edge.source) ?? [edge.source];
    const targets = instancesOf.get(edge.target) ?? [edge.target];
    if (sources.length === 1 && targets.length === 1) {
      return [{ ...edge, source: sources[0] as string, target: targets[0] as string }];
    }

    // A container that holds every drawing of both ends does not tell which drawings belong together
    const drawings = [...sources, ...targets];
    const everywhere = new Set(ancestors(drawings[0] as string).filter((x) => drawings.every((d) => ancestors(d).includes(x))));
    const sharedContainers = (a: string, b: string): number => {
      const ofB = new Set(ancestors(b));
      return ancestors(a).filter((x) => ofB.has(x) && !everywhere.has(x)).length;
    };

    const pairs = sources.flatMap((source) =>
      targets.map((target) => ({ source, target, score: sharedContainers(source, target) }))
    );
    const nested = pairs.filter((p) => contains(p.source, p.target) || contains(p.target, p.source));
    const bestForSource = new Map<string, number>();
    const bestForTarget = new Map<string, number>();
    for (const p of pairs) {
      bestForSource.set(p.source, Math.max(bestForSource.get(p.source) ?? 0, p.score));
      bestForTarget.set(p.target, Math.max(bestForTarget.get(p.target) ?? 0, p.score));
    }
    const shared = pairs.filter((p) => p.score > 0
      && p.score === bestForSource.get(p.source) && p.score === bestForTarget.get(p.target));
    let kept = nested;
    if (kept.length === 0) kept = sources.length === 1 || targets.length === 1 ? pairs : shared;
    if (kept.length === 0) kept = pairs.slice(0, 1);
    return kept.map((p, i) => ({ ...edge, id: i === 0 ? edge.id : copyEdgeId(edge.id, i), source: p.source, target: p.target }));
  });
}
