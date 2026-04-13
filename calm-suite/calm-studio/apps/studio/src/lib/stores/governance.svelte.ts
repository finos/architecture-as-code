// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * governance.svelte.ts — Reactive AIGF governance score store.
 *
 * Computes architecture-level governance score by counting applied vs
 * recommended mitigations across all AI nodes. Updates live as controls
 * are applied or removed.
 *
 * Patterns:
 * - Module-level $state runes (consistent with validation.svelte.ts)
 * - Exported accessor + mutation functions (no class instances)
 * - Score is a counter, NOT tied to the Validate button
 */

import { getModel } from '$lib/stores/calmModel.svelte';
import { isAINode, getAIGFForNodeType } from '@calmstudio/calm-core';
import type { AIGFRisk, AIGFMitigation } from '@calmstudio/calm-core';
import type { CalmControls } from '@calmstudio/calm-core';

// ─── Module-level state ───────────────────────────────────────────────────────

let selectedNodeGovernance = $state<{
	risks: AIGFRisk[];
	mitigations: AIGFMitigation[];
	nodeId: string | null;
	nodeControls: CalmControls | undefined;
}>({ risks: [], mitigations: [], nodeId: null, nodeControls: undefined });

let architectureScore = $state<number | null>(null);
let aiNodeCount = $state(0);

// ─── Accessor functions ───────────────────────────────────────────────────────

/** Returns the current architecture-level governance score (0-100), or null if no AI nodes. */
export function getArchitectureScore(): number | null {
	return architectureScore;
}

/** Returns true if the architecture contains at least one AI node. */
export function hasAINodes(): boolean {
	return aiNodeCount > 0;
}

/** Returns the governance state for the currently selected node. */
export function getSelectedNodeGovernance(): {
	risks: AIGFRisk[];
	mitigations: AIGFMitigation[];
	nodeId: string | null;
	nodeControls: CalmControls | undefined;
} {
	return selectedNodeGovernance;
}

// ─── Mutation functions ───────────────────────────────────────────────────────

/**
 * Refresh architecture-level governance score.
 * Call this whenever the model mutates — after property changes, control apply, etc.
 */
export function refreshGovernance(): void {
	const arch = getModel();
	const aiNodes = arch.nodes.filter((n) => isAINode(n['node-type']));
	aiNodeCount = aiNodes.length;

	if (aiNodes.length === 0) {
		architectureScore = null;
		return;
	}

	let totalRecommended = 0;
	let totalApplied = 0;

	for (const node of aiNodes) {
		const { mitigations } = getAIGFForNodeType(node['node-type']);
		const controls = (node as { controls?: CalmControls }).controls ?? {};
		totalRecommended += mitigations.length;
		for (const mit of mitigations) {
			if (controls[mit.calmControlKey] !== undefined) {
				totalApplied++;
			}
		}
	}

	if (totalRecommended === 0) {
		architectureScore = 100;
	} else {
		architectureScore = Math.round((totalApplied / totalRecommended) * 100);
	}
}

/**
 * Update governance state for the currently selected node.
 * Call this when selection changes (pass null to clear).
 *
 * @param nodeType  The CALM node-type string (e.g. 'ai:agent'), or null to clear
 * @param nodeId    The unique-id of the selected node, or null to clear
 */
export function updateSelectedNodeGovernance(
	nodeType: string | null,
	nodeId: string | null
): void {
	if (!nodeType || !nodeId || !isAINode(nodeType)) {
		selectedNodeGovernance = {
			risks: [],
			mitigations: [],
			nodeId: null,
			nodeControls: undefined,
		};
		return;
	}

	const { risks, mitigations } = getAIGFForNodeType(nodeType);
	const arch = getModel();
	const node = arch.nodes.find((n) => n['unique-id'] === nodeId);
	const nodeControls = (node as { controls?: CalmControls } | undefined)?.controls;

	selectedNodeGovernance = { risks, mitigations, nodeId, nodeControls };
}
