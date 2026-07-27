// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import {
  getContainerAndNodes,
  getRelationshipVariant,
  type CalmRelationship,
} from '@calmstudio/calm-core';
import { isFlatRelationship, type DiagramEdge } from './relationshipEdges.js';

/**
 * The result of resolving containment relationships into a render forest.
 * Satisfiable claims become parent/child nesting; everything else becomes
 * a deterministic fallback edge (rendered dashed, exactly like the
 * pre-nesting behavior).
 */
export interface ContainmentPlan {
  /** containerId -> member node ids (only satisfiable claims, document order) */
  childrenOf: Map<string, string[]>;
  /** nodeId -> containerId (inverse of childrenOf) */
  parentOf: Map<string, string>;
  /** Unsatisfiable claims, as dashed edges with fan-out id rules */
  fallbackEdges: DiagramEdge[];
  /** Containment relationships fully represented by nesting (no edges at all). Informational: the renderer filters containment relationships via isNestedContainment (a partially-fallen-back relationship must not fan out either), so it does not read this set; it exists for consumers that need to know which relationships are fully expressed by nesting. */
  consumedRelationshipIds: Set<string>;
}

export function emptyContainmentPlan(): ContainmentPlan {
  return {
    childrenOf: new Map(),
    parentOf: new Map(),
    fallbackEdges: [],
    consumedRelationshipIds: new Set(),
  };
}

/** True for canonical nested composed-of / deployed-in relationships only. */
export function isNestedContainment(rel: CalmRelationship): boolean {
  if (isFlatRelationship(rel)) return false;
  const variant = getRelationshipVariant(rel['relationship-type']);
  return variant === 'composed-of' || variant === 'deployed-in';
}

/** Walk parentOf upward from `start`; true if `target` is an ancestor of `start`. */
function hasAncestor(parentOf: Map<string, string>, start: string, target: string): boolean {
  let current: string | undefined = parentOf.get(start);
  while (current !== undefined) {
    if (current === target) return true;
    current = parentOf.get(current);
  }
  return false;
}

/**
 * Resolve containment claims in document order. A claim container⊃member is
 * satisfiable iff: both ids exist, member is not already claimed, member is
 * not the container itself, and nesting would not create a cycle (the
 * container is not itself a descendant of the member). Unsatisfiable claims
 * fall back to edges; a relationship with zero fallbacks is fully consumed.
 */
export function planContainment(
  relationships: CalmRelationship[],
  knownNodeIds: Set<string>
): ContainmentPlan {
  const plan = emptyContainmentPlan();

  for (const rel of relationships) {
    if (!isNestedContainment(rel)) continue;
    const uid = rel['unique-id'];
    const variant = getRelationshipVariant(rel['relationship-type']);
    const containerAndNodes = getContainerAndNodes(rel);
    if (!containerAndNodes || !containerAndNodes.container) continue;
    const { container } = containerAndNodes;
    const members = (containerAndNodes.nodes ?? []).filter(
      (n): n is string => typeof n === 'string' && n.length > 0
    );
    if (members.length === 0) continue;

    const rejected: string[] = [];
    for (const member of members) {
      const satisfiable =
        knownNodeIds.has(container) &&
        knownNodeIds.has(member) &&
        member !== container &&
        !plan.parentOf.has(member) &&
        !hasAncestor(plan.parentOf, container, member);
      if (satisfiable) {
        const siblings = plan.childrenOf.get(container) ?? [];
        siblings.push(member);
        plan.childrenOf.set(container, siblings);
        plan.parentOf.set(member, container);
      } else {
        rejected.push(member);
      }
    }

    if (rejected.length === 0) {
      plan.consumedRelationshipIds.add(uid);
    } else if (rejected.length === 1) {
      plan.fallbackEdges.push({
        id: uid,
        relationshipId: uid,
        source: container,
        target: rejected[0] as string,
        variant,
      });
    } else {
      rejected.forEach((target, index) => {
        plan.fallbackEdges.push({
          id: `${uid}__${index}`,
          relationshipId: uid,
          source: container,
          target,
          variant,
        });
      });
    }
  }

  return plan;
}
