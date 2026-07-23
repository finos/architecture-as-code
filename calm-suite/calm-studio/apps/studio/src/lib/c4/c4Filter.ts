// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * c4Filter.ts — Pure C4 classification, filtering, external detection, and style injection.
 *
 * Maps CALM node types to C4 levels (Context/Container/Component) and provides
 * filtering functions for C4 view mode. All functions are pure — no imports from
 * .svelte.ts files, fully testable in vitest.
 *
 * C4 Level mapping (per locked decisions in 08-CONTEXT.md):
 *   - Context:   actor, system, ecosystem
 *   - Container: service, database, webclient, network, ldap, data-asset
 *   - Component: aws:*, gcp:*, azure:*, k8s:*, ai:*, generic, custom types (default)
 */

import type { Node, Edge } from '@xyflow/svelte';

// ─── Types ───────────────────────────────────────────────────────────────────

/** The three C4 view levels. null represents "All" (normal editing mode). */
export type C4Level = 'context' | 'container' | 'component';

// ─── Classification Sets ──────────────────────────────────────────────────────

/** CALM types that map to C4 Context level (top-level architectural actors and systems). */
const CONTEXT_TYPES = new Set(['actor', 'system', 'ecosystem']);

/** CALM types that map to C4 Container level (deployable units). */
const CONTAINER_TYPES = new Set(['service', 'database', 'webclient', 'network', 'ldap', 'data-asset']);

// ─── Classification ───────────────────────────────────────────────────────────

/**
 * Classifies a CALM node type string into a C4Level.
 *
 * - actor, system, ecosystem → 'context'
 * - service, database, webclient, network, ldap, data-asset → 'container'
 * - Everything else (aws:*, k8s:*, generic, custom) → 'component'
 *
 * @param calmType - The CALM node-type string (e.g., 'actor', 'aws:lambda').
 */
export function classifyNodeC4Level(calmType: string): C4Level {
	if (CONTEXT_TYPES.has(calmType)) return 'context';
	if (CONTAINER_TYPES.has(calmType)) return 'container';
	return 'component';
}

// ─── External Detection ───────────────────────────────────────────────────────

/**
 * Returns true if the node should be treated as external at C4 Context level.
 *
 * External nodes are:
 *   1. Nodes with calmType === 'ecosystem' (auto-detected as external)
 *   2. Nodes with customMetadata['c4-scope'] === 'external' (explicitly tagged)
 *
 * @param node - A Svelte Flow node (only data field is needed).
 */
export function isExternalNode(node: { data?: Record<string, unknown> }): boolean {
	const data = node.data ?? {};

	// Auto-detect ecosystem as external
	if (data.calmType === 'ecosystem') return true;

	// Check explicit c4-scope metadata
	const customMetadata = data.customMetadata as Record<string, string> | undefined;
	if (customMetadata?.['c4-scope'] === 'external') return true;

	return false;
}

// ─── Filtering ────────────────────────────────────────────────────────────────

/**
 * Filters nodes to show only those appropriate for the given C4 level.
 *
 * - If drillParentId is provided: returns only direct children of that parent node
 *   (used when drilling into a container to show its internals).
 * - If drillParentId is null:
 *   - Context level: top-level systems/actors/ecosystems only (flat view).
 *   - Container level: all container-type nodes + their ancestor containers
 *     (so services/databases inside systems display correctly in their grouping).
 *   - Component level: all component-type nodes + their ancestor containers.
 *
 * @param nodes - All Svelte Flow nodes.
 * @param level - The C4 level to filter for.
 * @param drillParentId - Parent node ID when drilled in, or null for top-level view.
 */
export function filterNodesForLevel(
	nodes: Node[],
	level: C4Level,
	drillParentId: string | null
): Node[] {
	// Drill-down mode: show direct children of the drill target
	if (drillParentId !== null) {
		return nodes.filter((n) => n.parentId === drillParentId);
	}

	// Context level: only top-level nodes (flat view of systems/actors)
	if (level === 'context') {
		return nodes.filter((n) => {
			if (n.parentId) return false;
			const calmType = (n.data?.calmType as string) ?? '';
			return classifyNodeC4Level(calmType) === level;
		});
	}

	// Container/Component levels: show matching nodes + their ancestor containers
	// so nested nodes display correctly within their parent groupings.
	const nodeMap = new Map(nodes.map((n) => [n.id, n]));

	// Find all nodes matching the target C4 level
	const matchingNodes = nodes.filter((n) => {
		const calmType = (n.data?.calmType as string) ?? '';
		return classifyNodeC4Level(calmType) === level;
	});

	const resultIds = new Set(matchingNodes.map((n) => n.id));

	// Walk up parentId chains to include ancestor containers
	for (const node of matchingNodes) {
		let current: Node | undefined = node;
		while (current?.parentId) {
			resultIds.add(current.parentId);
			current = nodeMap.get(current.parentId);
		}
	}

	return nodes.filter((n) => resultIds.has(n.id));
}

/**
 * Filters edges to only include those where both endpoints are visible.
 *
 * Edges are hidden when either their source or target node is not in the visible set.
 *
 * @param edges - All Svelte Flow edges.
 * @param visibleIds - Set of visible node IDs (build from filtered nodes array).
 */
export function filterEdgesForVisibleNodes(edges: Edge[], visibleIds: Set<string>): Edge[] {
	return edges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target));
}

/**
 * Lifts edges to the current C4 abstraction level.
 *
 * When a C4 view hides intermediary nodes, edges between them disappear.
 * This function maps hidden endpoints to their nearest visible ancestor
 * (via parentId containment chain) and creates synthetic lifted edges
 * between the visible representatives.
 *
 * Example: At Context level, "End User → Web App → API Gateway → Order Service"
 * becomes "End User → Order Management System" because Order Service's
 * visible ancestor is Order Management System.
 *
 * @param edges - All Svelte Flow edges.
 * @param allNodes - All Svelte Flow nodes (for parentId lookups).
 * @param visibleIds - Set of visible (non-peer) node IDs.
 */
export function liftEdgesForLevel(
	edges: Edge[],
	allNodes: Node[],
	visibleIds: Set<string>
): Edge[] {
	const nodeMap = new Map(allNodes.map((n) => [n.id, n]));

	// Build mapping: nodeId → visible representative (walk up parentId chain)
	const repCache = new Map<string, string | null>();
	function getVisibleRep(nodeId: string): string | null {
		if (repCache.has(nodeId)) return repCache.get(nodeId)!;
		if (visibleIds.has(nodeId)) {
			repCache.set(nodeId, nodeId);
			return nodeId;
		}
		const node = nodeMap.get(nodeId);
		if (!node?.parentId) {
			repCache.set(nodeId, null);
			return null;
		}
		const rep = getVisibleRep(node.parentId);
		repCache.set(nodeId, rep);
		return rep;
	}

	// Direct edges (both endpoints visible)
	const directEdges = edges.filter(
		(e) => visibleIds.has(e.source) && visibleIds.has(e.target)
	);

	// Lifted edges (at least one endpoint hidden, mapped to visible ancestor)
	const seenPairs = new Set<string>();
	// Mark direct edge pairs as already seen
	for (const e of directEdges) {
		seenPairs.add(`${e.source}->${e.target}`);
	}

	const liftedEdges: Edge[] = [];
	for (const e of edges) {
		if (visibleIds.has(e.source) && visibleIds.has(e.target)) continue; // already direct
		const srcRep = getVisibleRep(e.source);
		const tgtRep = getVisibleRep(e.target);
		if (!srcRep || !tgtRep || srcRep === tgtRep) continue;

		const pairKey = `${srcRep}->${tgtRep}`;
		if (seenPairs.has(pairKey)) continue;
		seenPairs.add(pairKey);

		liftedEdges.push({
			id: `lifted-${pairKey}`,
			source: srcRep,
			target: tgtRep,
			type: 'default',
			style: 'stroke-dasharray: 6 3;',
			data: { lifted: true },
		});
	}

	return [...directEdges, ...liftedEdges];
}

// ─── Children Helpers ─────────────────────────────────────────────────────────

/**
 * Returns all direct children of a parent node.
 *
 * @param parentId - The ID of the parent node.
 * @param nodes - All Svelte Flow nodes.
 */
export function getChildrenOf(parentId: string, nodes: Node[]): Node[] {
	return nodes.filter((n) => n.parentId === parentId);
}

/**
 * Returns true when the given node has at least one direct child.
 * Used to decide whether to show a drill-down affordance (double-click hint).
 *
 * @param nodeId - The ID of the node to check.
 * @param nodes - All Svelte Flow nodes.
 */
export function hasDrillableChildren(nodeId: string, nodes: Node[]): boolean {
	return nodes.some((n) => n.parentId === nodeId);
}

// ─── Style Injection ──────────────────────────────────────────────────────────

/**
 * Injects C4 styling metadata into each node's data.
 *
 * Adds:
 *   - data.c4Level: the current C4 level (for CSS class or conditional rendering)
 *   - data.c4External: whether this node is external (for greying out + badge)
 *
 * Returns a new array — does not mutate input nodes. Uses shallow spread on data.
 *
 * @param nodes - The filtered set of visible nodes.
 * @param level - The current C4 level being displayed.
 */
export function applyC4Styles(nodes: Node[], level: C4Level): Node[] {
	// At Context level, collect visible node IDs so we can detect "childless containers"
	const visibleIds = new Set(nodes.map((n) => n.id));

	return nodes.map((node) => {
		const external = isExternalNode(node);
		const peer = node.data?.c4Peer === true;

		// Build CSS class string for Svelte Flow node wrapper
		const classes: string[] = [];
		if (external) classes.push('c4-external');
		if (peer) classes.push('c4-peer');
		const classValue = classes.length > 0 ? classes.join(' ') : undefined;

		// At Context level, container-typed nodes (systems/ecosystems with children)
		// should render as compact nodes, not as giant empty containers.
		// Resolve their type back to the original CALM type and remove container dimensions.
		let typeOverride: Record<string, unknown> = {};
		if (level === 'context' && node.type === 'container') {
			const calmType = (node.data?.calmType as string) ?? '';
			if (CONTEXT_TYPES.has(calmType)) {
				typeOverride = {
					type: calmType,
					width: undefined,
					height: undefined,
				};
			}
		}

		// At Container/Component levels, ancestor container nodes whose children
		// are all filtered out should also render compactly.
		if (level !== 'context' && node.type === 'container') {
			const hasVisibleChildren = nodes.some((n) => n.parentId === node.id && visibleIds.has(n.id));
			if (!hasVisibleChildren) {
				const calmType = (node.data?.calmType as string) ?? '';
				const resolvedType = CONTEXT_TYPES.has(calmType) ? calmType : CONTAINER_TYPES.has(calmType) ? calmType : 'generic';
				typeOverride = {
					type: resolvedType,
					width: undefined,
					height: undefined,
				};
			}
		}

		return {
			...node,
			...(classValue !== undefined ? { class: classValue } : {}),
			...typeOverride,
			data: {
				...node.data,
				c4Level: level,
				c4External: external,
			},
		};
	});
}
