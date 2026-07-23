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
import { ensureSchemaOnFirstElement, mergeArchitectureBody } from '$lib/stores/documentEnvelope';

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

/** Hint for schema envelope when the first palette node is placed. */
let lastPlacedNodeType: string | undefined;

/**
 * Apply a CalmArchitecture from JSON (e.g., from the code editor or file load).
 * Returns true on success, false if a sync is already in progress.
 */
export function applyFromJson(arch: CalmArchitecture): boolean {
	return withMutex(() => {
		model = {
			...arch,
			nodes: [...arch.nodes],
			relationships: [...(arch.relationships ?? [])],
		};
		lastPlacedNodeType = undefined;
	});
}

/**
 * Merge canvas-projected relationships with the canonical model so metadata and
 * other CALM fields survive export when Svelte Flow edge data is partial.
 */
function enrichRelationshipsFromModel(
	canvasRels: CalmRelationship[],
	modelRels: CalmRelationship[]
): CalmRelationship[] {
	if (modelRels.length === 0) return canvasRels;

	const modelById = new Map(modelRels.map((r) => [r['unique-id'], r]));

	return canvasRels.map((cr) => {
		const baseId = cr['unique-id'].includes('#')
			? cr['unique-id'].slice(0, cr['unique-id'].indexOf('#'))
			: cr['unique-id'];
		const modelRel = modelById.get(cr['unique-id']) ?? modelById.get(baseId);
		if (!modelRel) return cr;
		return {
			...modelRel,
			...cr,
			'relationship-type': cr['relationship-type'],
		};
	});
}

function isContainmentRelationship(rel: CalmRelationship): boolean {
	const rt = rel['relationship-type'];
	return 'composed-of' in rt || 'deployed-in' in rt;
}

/**
 * When Svelte Flow has parentId nesting but the bound `edges` array is still
 * empty, keep connects/interacts/options from the model and only refresh
 * containment from inferred parentId edges.
 */
function mergeContainmentFromInferred(
	modelRels: CalmRelationship[],
	inferredRels: CalmRelationship[]
): CalmRelationship[] {
	const nonContainment = modelRels.filter((r) => !isContainmentRelationship(r));
	return [...nonContainment, ...inferredRels];
}

/** Model relationship ids currently represented on the canvas edge list. */
function representedModelRelIds(flowEdges: Edge[]): Set<string> {
	const ids = new Set<string>();
	for (const e of flowEdges) {
		const d = (e.data ?? {}) as { calmRelId?: string };
		const base =
			d.calmRelId ??
			(e.id.includes('#') ? e.id.slice(0, e.id.indexOf('#')) : e.id);
		if (!base.startsWith('inferred-')) {
			ids.add(base);
		}
	}
	return ids;
}

function appendMissingModelRelationships(
	canvasRels: CalmRelationship[],
	modelRels: CalmRelationship[],
	flowEdges: Edge[]
): CalmRelationship[] {
	if (modelRels.length === 0) return canvasRels;
	const represented = representedModelRelIds(flowEdges);
	const missing = modelRels.filter((r) => !represented.has(r['unique-id']));
	if (missing.length === 0) return canvasRels;
	return [...canvasRels, ...missing];
}

export type PersistArchitectureOptions = {
	/** For export/save: keep model relationships not yet bound on the canvas. */
	preserveMissingFromModel?: boolean;
};

/**
 * Build the architecture body to persist/export from the live canvas.
 *
 * Canvas edges are authoritative when the bound `edges` array is non-empty.
 * When it is still empty (import/remount/tab switch), keep canonical model
 * relationships instead of replacing them with parentId-only containment.
 */
export function buildPersistedArchitecture(
	flowNodes: Node[],
	flowEdges: Edge[],
	envelope: CalmArchitecture = model,
	options?: PersistArchitectureOptions
): CalmArchitecture {
	const preserveMissing = options?.preserveMissingFromModel ?? false;
	const canvasBody = flowToCalm(flowNodes, flowEdges);
	const modelRelationships = envelope.relationships ?? [];

	if (flowNodes.length === 0 && flowEdges.length === 0) {
		// Canvas not bound yet (tab switch / remount) — keep loaded model.
		if (envelope.nodes.length > 0 || (envelope.relationships?.length ?? 0) > 0) {
			return envelope;
		}
		return mergeArchitectureBody(envelope, { nodes: [], relationships: [] });
	}

	let relationships: CalmRelationship[];

	if (flowEdges.length === 0) {
		relationships =
			modelRelationships.length > 0
				? mergeContainmentFromInferred(modelRelationships, canvasBody.relationships)
				: canvasBody.relationships;
	} else {
		relationships = enrichRelationshipsFromModel(canvasBody.relationships, modelRelationships);
		if (preserveMissing) {
			relationships = appendMissingModelRelationships(
				relationships,
				modelRelationships,
				flowEdges
			);
		}
	}

	return mergeArchitectureBody(envelope, { nodes: canvasBody.nodes, relationships });
}

export function applyFromCanvas(nodes: Node[], edges: Edge[]): boolean {
	return withMutex(() => {
		let next = buildPersistedArchitecture(nodes, edges);
		if (!next['$schema'] && next.nodes.length > 0) {
			next = ensureSchemaOnFirstElement(next, lastPlacedNodeType);
		}
		model = next;
		lastPlacedNodeType = undefined;
	});
}

/** JSON ready for export/save — always merges live canvas with canonical model. */
export function getExportJson(nodes: Node[], edges: Edge[]): string {
	const arch = buildPersistedArchitecture(nodes, edges, model, {
		preserveMissingFromModel: true,
	});
	return JSON.stringify(arch, null, 2);
}

/** Call before placing the first node from the palette to set extension schema hint. */
export function setSchemaHintForNodeType(calmType: string): void {
	lastPlacedNodeType = calmType;
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
			const existing =
				typeof n.customMetadata === 'object' && n.customMetadata !== null
					? (n.customMetadata as Record<string, string>)
					: {};
			return {
				...n,
				customMetadata: { ...existing, [key]: value },
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
			const existing =
				typeof n.customMetadata === 'object' && n.customMetadata !== null
					? (n.customMetadata as Record<string, string>)
					: {};
			const updated = { ...existing };
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
