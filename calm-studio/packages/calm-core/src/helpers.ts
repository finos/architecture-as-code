// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * helpers.ts — Variant accessors over the canonical CALM relationship-type.
 *
 * Operates on the @finos/calm-models nested shape. These helpers are kept
 * local to calm-studio because they encode CalmStudio-specific traversal
 * conventions (e.g. defensive null handling for partial/malformed input
 * that the studio editor may produce mid-keystroke). They are
 * intentionally not in calm-models, which models the canonical schema only.
 */

import type {
  CalmRelationship,
  CalmRelationshipType,
  CalmRelationshipVariant,
} from './types.js';

/**
 * Return the variant key actually present on a nested relationship-type.
 * Useful for switching without exhaustively probing each variant.
 */
export function getRelationshipVariant(
  rt: CalmRelationshipType,
): CalmRelationshipVariant {
  if (rt.connects !== undefined) return 'connects';
  if (rt['composed-of'] !== undefined) return 'composed-of';
  if (rt.interacts !== undefined) return 'interacts';
  if (rt['deployed-in'] !== undefined) return 'deployed-in';
  return 'options';
}

/**
 * Best-effort extraction of source/destination node ids from a connects
 * variant. Returns null for any other variant.
 */
export function getConnectsEndpoints(
  rel: CalmRelationship,
): { source: string; destination: string } | null {
  const c = rel['relationship-type'].connects;
  if (!c) return null;
  return { source: c.source.node, destination: c.destination.node };
}

/** Return container + child-node ids for composed-of / deployed-in variants. */
export function getContainerAndNodes(
  rel: CalmRelationship,
): { container: string; nodes: string[] } | null {
  const rt = rel['relationship-type'];
  if (rt['composed-of']) {
    return { container: rt['composed-of'].container, nodes: rt['composed-of'].nodes };
  }
  if (rt['deployed-in']) {
    return { container: rt['deployed-in'].container, nodes: rt['deployed-in'].nodes };
  }
  return null;
}

/** Return actor + interacted-with node ids for the interacts variant. */
export function getActorAndNodes(
  rel: CalmRelationship,
): { actor: string; nodes: string[] } | null {
  const i = rel['relationship-type'].interacts;
  if (!i) return null;
  return { actor: i.actor, nodes: i.nodes };
}

/**
 * Flatten any nested relationship to the set of node unique-ids it
 * references. Used by validation / graph-traversal code that doesn't
 * care about direction. Defensive: returns [] for partial input the
 * editor may produce mid-keystroke.
 */
export function getReferencedNodeIds(rel: CalmRelationship): string[] {
  const rt = rel['relationship-type'];
  if (rt.connects) {
    const out: string[] = [];
    if (rt.connects.source?.node) out.push(rt.connects.source.node);
    if (rt.connects.destination?.node) out.push(rt.connects.destination.node);
    return out;
  }
  if (rt['composed-of']) {
    const co = rt['composed-of'];
    const out: string[] = [];
    if (co.container) out.push(co.container);
    if (Array.isArray(co.nodes)) out.push(...co.nodes);
    return out;
  }
  if (rt['deployed-in']) {
    const d = rt['deployed-in'];
    const out: string[] = [];
    if (d.container) out.push(d.container);
    if (Array.isArray(d.nodes)) out.push(...d.nodes);
    return out;
  }
  if (rt.interacts) {
    const i = rt.interacts;
    const out: string[] = [];
    if (i.actor) out.push(i.actor);
    if (Array.isArray(i.nodes)) out.push(...i.nodes);
    return out;
  }
  return [];
}
