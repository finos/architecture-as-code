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
