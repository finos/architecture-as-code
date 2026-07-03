// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * calmModel.svelte.ts — Canonical CALM model store with direction mutex.
 *
 * Provides a single source of truth for the CalmArchitecture currently being
 * edited in CalmStudio. All changes flow through this store.
 *
 * Direction mutex: applyFromJson and applyFromCanvas use a `syncing` flag to
 * prevent re-entrant sync calls (canvas→model→canvas loops).
 *
 * Mutation functions (updateNodeProperty, addInterface, etc.) do NOT use the
 * mutex — they are called from UI event handlers, not sync paths.
 */

import type { Node, Edge } from '@xyflow/svelte';
import type { CalmArchitecture, CalmInterface, CalmNode, CalmRelationship } from '@calmstudio/calm-core';
import { flowToCalm } from '$lib/stores/projection';

// ─── Module-level state ───────────────────────────────────────────────────────

/** The canonical CALM model — single source of truth. */
let model = $state<CalmArchitecture>({ nodes: [], relationships: [] });

/** Direction mutex — plain boolean (no reactivity needed). */
let syncing = false;

// ─── Direction mutex helpers ──────────────────────────────────────────────────

/**
 * Execute fn inside the direction mutex.
 * Returns false if already syncing (re-entrant call); otherwise returns true.
 */
function withMutex(fn: () => void): boolean {
	if (syncing) return false;
	syncing = true;
	try {
		fn();
	} finally {
		syncing = false;
	}
	return true;
}

// ─── Sync entry points ────────────────────────────────────────────────────────

/**
 * Apply a CalmArchitecture from JSON (e.g., from the code editor or file load).
 * Returns true on success, false if a sync is already in progress.
 */
export function applyFromJson(arch: CalmArchitecture): boolean {
	return withMutex(() => {
		model = { nodes: [...arch.nodes], relationships: [...arch.relationships] };
	});
}

/**
 * Apply Svelte Flow nodes/edges from the canvas (e.g., after drag/drop).
 * Converts via flowToCalm and updates the canonical model.
 * Returns true on success, false if a sync is already in progress.
 */
export function applyFromCanvas(nodes: Node[], edges: Edge[]): boolean {
	return withMutex(() => {
		const arch = flowToCalm(nodes, edges);
		model = { nodes: [...arch.nodes], relationships: [...arch.relationships] };
	});
}

// ─── Read accessors ───────────────────────────────────────────────────────────

/** Returns the current CalmArchitecture. */
export function getModel(): CalmArchitecture {
	return model;
}

/** Returns the current model as a pretty-printed JSON string (2-space indent). */
export function getModelJson(): string {
	return JSON.stringify(model, null, 2);
}

// ─── Node mutations ───────────────────────────────────────────────────────────

/**
 * Update a property on a node by unique-id.
 * Creates a new node object to trigger $state reactivity.
 */
export function updateNodeProperty(nodeId: string, key: string, value: unknown): void {
	model = {
		...model,
		nodes: model.nodes.map((n) =>
			n['unique-id'] === nodeId ? { ...n, [key]: value } : n
		),
	};
}

// ─── Edge mutations ───────────────────────────────────────────────────────────

/**
 * Update a property on a relationship by unique-id.
 * Creates a new relationship object to trigger $state reactivity.
 */
export function updateEdgeProperty(edgeId: string, key: string, value: unknown): void {
	model = {
		...model,
		relationships: model.relationships.map((r) =>
			r['unique-id'] === edgeId ? { ...r, [key]: value } : r
		),
	};
}

// ─── Interface CRUD ───────────────────────────────────────────────────────────

/**
 * Add an interface to a node's interfaces array.
 * Initializes the array if it doesn't exist.
 */
export function addInterface(nodeId: string, iface: CalmInterface): void {
	model = {
		...model,
		nodes: model.nodes.map((n: CalmNode) => {
			if (n['unique-id'] !== nodeId) return n;
			return { ...n, interfaces: [...(n.interfaces ?? []), iface] };
		}),
	};
}

/**
 * Remove an interface from a node by interfaceId.
 */
export function removeInterface(nodeId: string, interfaceId: string): void {
	model = {
		...model,
		nodes: model.nodes.map((n: CalmNode) => {
			if (n['unique-id'] !== nodeId) return n;
			return {
				...n,
				interfaces: (n.interfaces ?? []).filter((i) => i['unique-id'] !== interfaceId),
			};
		}),
	};
}

/**
 * Update fields on an existing interface.
 * Merges the updates into the interface using spread.
 */
export function updateInterface(
	nodeId: string,
	interfaceId: string,
	updates: Partial<CalmInterface>
): void {
	model = {
		...model,
		nodes: model.nodes.map((n: CalmNode) => {
			if (n['unique-id'] !== nodeId) return n;
			return {
				...n,
				interfaces: (n.interfaces ?? []).map((i) =>
					i['unique-id'] === interfaceId ? { ...i, ...updates } : i
				),
			};
		}),
	};
}

// ─── Custom metadata CRUD ─────────────────────────────────────────────────────

/**
 * Add or update a custom metadata key-value pair on a node.
 */
export function addCustomMetadata(nodeId: string, key: string, value: string): void {
	model = {
		...model,
		nodes: model.nodes.map((n: CalmNode) => {
			if (n['unique-id'] !== nodeId) return n;
			return {
				...n,
				customMetadata: { ...(n.customMetadata ?? {}), [key]: value },
			};
		}),
	};
}

/**
 * Remove a custom metadata key from a node.
 */
export function removeCustomMetadata(nodeId: string, key: string): void {
	model = {
		...model,
		nodes: model.nodes.map((n: CalmNode) => {
			if (n['unique-id'] !== nodeId) return n;
			const updated = { ...(n.customMetadata ?? {}) };
			delete updated[key];
			return { ...n, customMetadata: updated };
		}),
	};
}

// ─── Test utilities ───────────────────────────────────────────────────────────

/**
 * Reset the model to empty state.
 * Use in tests with beforeEach to ensure clean state between tests.
 */
export function resetModel(): void {
	model = { nodes: [], relationships: [] };
	syncing = false;
}

// ─── Type re-exports for convenience ─────────────────────────────────────────

export type { CalmArchitecture, CalmNode, CalmRelationship, CalmInterface };
