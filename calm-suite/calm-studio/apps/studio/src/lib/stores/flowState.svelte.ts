// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * flowState.svelte.ts — Reactive flow selection store.
 *
 * Manages which CALM flow (if any) is currently active on the canvas.
 * When a flow is active, the canvas dims non-flow edges/nodes and shows
 * animated dot overlays with sequence badges on active flow edges.
 */
import type { CalmArchitecture, CalmTransition } from '@calmstudio/calm-core';

// Reactive state — module-level $state so it is shared across all consumers.
let activeFlowId = $state<string | null>(null);

/** Get the currently active flow ID, or null if no flow is active. */
export function getActiveFlowId(): string | null {
	return activeFlowId;
}

/** Set the active flow ID. Pass null to deactivate flow visualization. */
export function setActiveFlowId(id: string | null): void {
	activeFlowId = id;
}

/**
 * Compute the set of relationship unique-IDs that are part of the active flow.
 * Returns an empty Set when no flow is active or the flow ID is not found.
 */
export function getActiveFlowEdgeIds(arch: CalmArchitecture): Set<string> {
	if (!activeFlowId) return new Set();
	const flow = arch.flows?.find((f) => f['unique-id'] === activeFlowId);
	if (!flow) return new Set();
	return new Set(flow.transitions.map((t) => t['relationship-unique-id']));
}

/**
 * Return the CalmTransition for a given edge ID within the active flow.
 * Returns null when no flow is active, the flow is not found, or the edge
 * is not part of the active flow.
 */
export function getFlowTransitionForEdge(
	arch: CalmArchitecture,
	edgeId: string
): CalmTransition | null {
	if (!activeFlowId) return null;
	const flow = arch.flows?.find((f) => f['unique-id'] === activeFlowId);
	if (!flow) return null;
	return flow.transitions.find((t) => t['relationship-unique-id'] === edgeId) ?? null;
}

/**
 * Determine whether a node should be at full opacity in the current flow view.
 *
 * When no flow is active, all nodes are fully visible (returns true).
 * When a flow is active, only nodes that are the source or destination of
 * at least one active-flow edge are considered "in flow" (returns true).
 */
export function isNodeInActiveFlow(arch: CalmArchitecture, nodeId: string): boolean {
	if (!activeFlowId) return true; // No flow active — all nodes visible
	const flowEdgeIds = getActiveFlowEdgeIds(arch);
	if (flowEdgeIds.size === 0) return true;
	return arch.relationships.some(
		(r) => flowEdgeIds.has(r['unique-id']) && (r.source === nodeId || r.destination === nodeId)
	);
}
