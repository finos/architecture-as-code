// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * elkLayout.ts — Pure ELK.js layout engine for CALM architectures.
 *
 * Converts a CalmArchitecture into ELK graph format, runs auto-layout,
 * and returns a position map.
 *
 * IMPORTANT: This file must NOT import from .svelte.ts files — kept as pure
 * TypeScript for vitest testability (per RESEARCH Anti-Pattern).
 *
 * Per RESEARCH Pitfall 7: Treat ELK graph as flat (no nested children).
 * Sub-flow nesting is handled by @xyflow/svelte parentId independently.
 */

import ELK from 'elkjs/lib/elk.bundled.js';
import type { ElkNode, ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js';
import type {
	CalmArchitecture,
	CalmRelationship,
	CalmRelationshipVariant
} from '@calmstudio/calm-core';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LayoutDirection = 'DOWN' | 'RIGHT' | 'UP';

/** Position map: node unique-id -> {x, y, width?, height?} from ELK layout. */
export type PositionMap = Map<string, { x: number; y: number; width?: number; height?: number }>;

/** The set of CALM 1.2 variant keys that imply containment. */
const CONTAINMENT_VARIANTS: ReadonlySet<CalmRelationshipVariant> = new Set([
	'deployed-in',
	'composed-of'
]);

/**
 * Expand a CALM relationship into flat (source, target) edge pairs for layout.
 * Mirrors stores/projection.ts but kept local to avoid app→lib coupling.
 */
function expandLayoutPairs(
	rel: CalmRelationship,
): Array<{ source: string; target: string; variant: CalmRelationshipVariant }> {
	const rt = rel['relationship-type'];
	if ('connects' in rt) {
		return [
			{
				source: rt.connects.source.node,
				target: rt.connects.destination.node,
				variant: 'connects'
			}
		];
	}
	if ('composed-of' in rt) {
		return rt['composed-of'].nodes.map((child) => ({
			source: rt['composed-of'].container,
			target: child,
			variant: 'composed-of' as const
		}));
	}
	if ('deployed-in' in rt) {
		return rt['deployed-in'].nodes.map((child) => ({
			source: rt['deployed-in'].container,
			target: child,
			variant: 'deployed-in' as const
		}));
	}
	if ('interacts' in rt) {
		return rt.interacts.nodes.map((peer) => ({
			source: rt.interacts.actor,
			target: peer,
			variant: 'interacts' as const
		}));
	}
	return [];
}

/** Default node dimensions — sized to fit typical node labels + icons */
const NODE_WIDTH = 180;
const NODE_HEIGHT = 70;

// ─── ELK instance ─────────────────────────────────────────────────────────────

const elk = new ELK();

// ─── layoutCalm ──────────────────────────────────────────────────────────────

/**
 * Lays out a CALM architecture using ELK.js layered algorithm.
 *
 * Uses ELK's nested graph structure for containment relationships
 * (deployed-in, composed-of) so containers auto-size around their children.
 *
 * @param arch - The CALM architecture to lay out.
 * @param pinnedIds - Set of node unique-ids to exclude from layout.
 * @param direction - Layout direction: 'DOWN', 'RIGHT', 'UP'. Defaults to 'DOWN'.
 * @returns A Map of node unique-id to {x, y, width?, height?} for all NON-PINNED nodes.
 */
export async function layoutCalm(
	arch: CalmArchitecture,
	pinnedIds: Set<string>,
	direction: LayoutDirection = 'DOWN'
): Promise<PositionMap> {
	const freeNodes = arch.nodes.filter((n) => !pinnedIds.has(n['unique-id']));
	if (freeNodes.length === 0) return new Map();

	const freeNodeIds = new Set(freeNodes.map((n) => n['unique-id']));

	// Build containment map
	const childToParent = new Map<string, string>();
	const parentChildren = new Map<string, Set<string>>();

	for (const rel of arch.relationships) {
		for (const pair of expandLayoutPairs(rel)) {
			if (!CONTAINMENT_VARIANTS.has(pair.variant)) continue;
			if (pinnedIds.has(pair.source) || pinnedIds.has(pair.target)) continue;

			// In CALM 1.2, composed-of and deployed-in both use `container` as
			// the source position in the expanded pair → container is parent.
			const parentId = pair.source;
			const childId = pair.target;

			if (!freeNodeIds.has(parentId) || !freeNodeIds.has(childId)) continue;

			childToParent.set(childId, parentId);
			if (!parentChildren.has(parentId)) {
				parentChildren.set(parentId, new Set());
			}
			parentChildren.get(parentId)!.add(childId);
		}
	}

	// Flatten all relationships into (source, target) pairs once, then keep
	// only the non-containment pairs that connect two free, non-pinned nodes.
	type LayoutPair = { id: string; source: string; target: string };
	const layoutEdges: LayoutPair[] = [];
	for (const rel of arch.relationships) {
		const pairs = expandLayoutPairs(rel);
		const multi = pairs.length > 1;
		pairs.forEach((p, i) => {
			if (CONTAINMENT_VARIANTS.has(p.variant)) return;
			if (!freeNodeIds.has(p.source) || !freeNodeIds.has(p.target)) return;
			if (pinnedIds.has(p.source) || pinnedIds.has(p.target)) return;
			layoutEdges.push({
				id: multi ? `${rel['unique-id']}#${i}` : rel['unique-id'],
				source: p.source,
				target: p.target
			});
		});
	}

	// Find the direct child of a container that a descendant belongs to.
	// E.g., for VPC containing subnets containing services,
	// findDirectChildOf('vpc', 'order-service') → 'app-subnet'
	function findDirectChildOf(containerId: string, descendantId: string): string | null {
		let current = descendantId;
		while (childToParent.has(current)) {
			const parent = childToParent.get(current)!;
			if (parent === containerId) return current;
			current = parent;
		}
		return null;
	}

	// Collect all descendants of a container (recursive)
	function getAllDescendants(containerId: string): Set<string> {
		const result = new Set<string>();
		const stack = Array.from(parentChildren.get(containerId) ?? []);
		while (stack.length > 0) {
			const id = stack.pop()!;
			result.add(id);
			for (const child of parentChildren.get(id) ?? []) {
				stack.push(child);
			}
		}
		return result;
	}

	// Build ELK node tree recursively
	function buildElkNode(nodeId: string): ElkNode {
		const children = parentChildren.get(nodeId);
		const elkNode: ElkNode = {
			id: nodeId,
			width: NODE_WIDTH,
			height: NODE_HEIGHT,
		};

		if (children && children.size > 0) {
			// This is a container — add children and layout options
			elkNode.children = Array.from(children).map(buildElkNode);

			// Use the same direction at every nesting level. ELK layered naturally
			// handles both cases well:
			//   - Children with edges: flow in the direction (e.g., subnets stack vertically for DOWN)
			//   - Children without edges: spread perpendicular (e.g., instances spread horizontally for DOWN)

			// Let ELK auto-size the container; remove fixed dimensions
			delete elkNode.width;
			delete elkNode.height;

			// Add edges between direct children within this container
			const childSet = children;
			const innerEdges: ElkExtendedEdge[] = layoutEdges
				.filter((r) => childSet.has(r.source) && childSet.has(r.target))
				.map((r) => ({
					id: r.id,
					sources: [r.source],
					targets: [r.target],
				}));

			// Also find cross-child-container edges: edges between descendants in
			// different direct children. E.g., order-service (in app-subnet) →
			// order-db (in data-subnet) creates a synthetic app-subnet → data-subnet
			// edge so ELK can order the subnets correctly.
			const allDescendants = getAllDescendants(nodeId);
			const seenCrossEdgePairs = new Set<string>();
			for (const r of layoutEdges) {
				if (childSet.has(r.source) && childSet.has(r.target)) continue; // already handled
				if (!allDescendants.has(r.source) || !allDescendants.has(r.target)) continue;

				const srcChild = findDirectChildOf(nodeId, r.source);
				const tgtChild = findDirectChildOf(nodeId, r.target);
				if (!srcChild || !tgtChild || srcChild === tgtChild) continue;

				const pairKey = `${srcChild}->${tgtChild}`;
				if (seenCrossEdgePairs.has(pairKey)) continue;
				seenCrossEdgePairs.add(pairKey);

				innerEdges.push({
					id: `cross-${nodeId}-${pairKey}`,
					sources: [srcChild],
					targets: [tgtChild],
				});
			}

			// When a container has multiple children but no edges between them,
			// add synthetic chain edges following model order to preserve the
			// architect's intended flow (e.g., Public → Application → Data subnet).
			// Only chain container children (those with their own children) — leaf
			// nodes are left unchained so ELK can place them compactly alongside.
			const childArray = Array.from(children);
			const childrenWithEdges = new Set<string>();
			for (const e of innerEdges) {
				for (const s of e.sources) childrenWithEdges.add(s);
				for (const t of e.targets) childrenWithEdges.add(t);
			}
			const unconnectedContainers = childArray.filter(
				(id) => !childrenWithEdges.has(id) && parentChildren.has(id)
			);
			if (unconnectedContainers.length > 1) {
				for (let i = 0; i < unconnectedContainers.length - 1; i++) {
					innerEdges.push({
						id: `chain-${nodeId}-${i}`,
						sources: [unconnectedContainers[i]],
						targets: [unconnectedContainers[i + 1]],
					});
				}
			}

			if (innerEdges.length > 0) {
				elkNode.edges = innerEdges;
			}

			// Build layout options based on child structure:
			// 1. Children with edges AND some children are sub-containers (e.g., VPC
			//    with subnets): use layered with same direction to preserve vertical
			//    stacking of sub-containers in TTB mode.
			// 2. Children with edges but all are leaf nodes (e.g., Order Management
			//    System with services): use layered with perpendicular direction
			//    so services spread horizontally in TTB mode.
			// 3. No edges (e.g., subnets with instances): use rectpacking for
			//    horizontal row in TTB, vertical column in LTR.
			const hasSubContainers = childArray.some((id) => parentChildren.has(id));
			if (innerEdges.length > 0) {
				const edgeDirection = hasSubContainers
					? direction
					: direction === 'RIGHT' ? 'DOWN' : 'RIGHT';
				elkNode.layoutOptions = {
					'elk.algorithm': 'layered',
					'elk.direction': edgeDirection,
					'elk.padding': '[top=48,left=32,bottom=32,right=32]',
					'elk.spacing.nodeNode': '50',
					'elk.layered.spacing.nodeNodeBetweenLayers': '60',
					'elk.spacing.edgeNode': '30',
					'elk.spacing.edgeEdge': '20',
					'elk.layered.spacing.edgeNodeBetweenLayers': '30',
					'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
				};
			} else {
				elkNode.layoutOptions = {
					'elk.algorithm': 'rectpacking',
					'elk.padding': '[top=48,left=32,bottom=32,right=32]',
					'elk.spacing.nodeNode': '50',
					'elk.aspectRatio': direction === 'DOWN' ? '99' : '0.01',
				};
			}
		}

		return elkNode;
	}

	// Top-level nodes: not a child of anything
	const topLevelNodes = freeNodes
		.filter((n) => !childToParent.has(n['unique-id']))
		.map((n) => buildElkNode(n['unique-id']));

	// Top-level edges: both endpoints are top-level (or at least not within the same container)
	const topLevelNodeIds = new Set(topLevelNodes.map((n) => n.id));
	// For top-level edges, include edges where at least one endpoint is top-level
	// and neither is a child inside a container with the other
	const usedEdgeIds = new Set<string>();
	function collectUsedEdges(node: ElkNode) {
		for (const e of node.edges ?? []) usedEdgeIds.add(e.id);
		for (const c of node.children ?? []) collectUsedEdges(c);
	}
	topLevelNodes.forEach(collectUsedEdges);

	// Deduplicate: multiple inner edges may map to the same top-level ancestor pair
	const seenTopEdgePairs = new Set<string>();
	const topEdges: ElkExtendedEdge[] = [];
	for (const r of layoutEdges) {
		if (usedEdgeIds.has(r.id)) continue;
		const src = findTopLevelAncestor(r.source, childToParent);
		const tgt = findTopLevelAncestor(r.target, childToParent);
		// Skip self-loops (both endpoints inside same top-level container)
		if (src === tgt) continue;
		const pairKey = `${src}->${tgt}`;
		if (seenTopEdgePairs.has(pairKey)) continue;
		seenTopEdgePairs.add(pairKey);
		topEdges.push({
			id: r.id,
			sources: [src],
			targets: [tgt],
		});
	}

	const graph: ElkNode = {
		id: 'root',
		layoutOptions: {
			'elk.algorithm': 'layered',
			'elk.direction': direction,
			'elk.layered.spacing.nodeNodeBetweenLayers': '120',
			'elk.spacing.nodeNode': '100',
			'elk.spacing.edgeNode': '40',
			'elk.spacing.edgeEdge': '25',
			'elk.layered.spacing.edgeNodeBetweenLayers': '40',
			'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
		},
		children: topLevelNodes,
		edges: topEdges,
	};

	const layouted = await elk.layout(graph);

	// Extract positions recursively from ELK result
	const positionMap: PositionMap = new Map();
	function extractPositions(node: ElkNode) {
		for (const child of node.children ?? []) {
			if (child.x !== undefined && child.y !== undefined) {
				positionMap.set(child.id, {
					x: child.x,
					y: child.y,
					width: child.width,
					height: child.height,
				});
			}
			extractPositions(child);
		}
	}
	extractPositions(layouted);

	return positionMap;
}

/**
 * Walk up the containment tree to find the top-level ancestor of a node.
 * Used for routing cross-container edges at the top level in ELK.
 */
function findTopLevelAncestor(nodeId: string, childToParent: Map<string, string>): string {
	let current = nodeId;
	while (childToParent.has(current)) {
		current = childToParent.get(current)!;
	}
	return current;
}
