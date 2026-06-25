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
import type {
	CalmArchitecture,
	CalmControls,
	CalmDecorator,
	CalmInterface,
	CalmNode,
	CalmRelationship
} from '@calmstudio/calm-core';
import { flowToCalm, variantOf } from '$lib/stores/projection';
import { mergeDecoratorLists } from '$lib/io/decoratorMigration';

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
		// Preserve ALL document-level keys ($schema, metadata, flows, adrs,
		// decorators, controls, …); nodes/relationships are copied as arrays.
		// Previously this rebuilt { nodes, relationships } only, silently dropping
		// every other section on open→save.
		model = { ...arch, nodes: [...arch.nodes], relationships: [...arch.relationships] };
	});
}

/**
 * Apply Svelte Flow nodes/edges from the canvas (e.g., after drag/drop).
 * Converts via flowToCalm and updates the canonical model.
 * Returns true on success, false if a sync is already in progress.
 */
export function applyFromCanvas(nodes: Node[], edges: Edge[]): boolean {
	return withMutex(() => {
		const projected = flowToCalm(nodes, edges);

		// `options` relationships have no edge representation, so they never come
		// back from flowToCalm. Carry them from the prior model, GC'ing any
		// decision whose node/relationship references no longer resolve so we never
		// write a dangling ref. The relationship itself is kept even when its
		// decisions array ends up empty — `options: []` is valid CALM (no minItems),
		// so dropping it would be lossy for a legitimately-empty options input.
		const nodeIds = new Set(projected.nodes.map((n) => n['unique-id']));
		const relIds = new Set(projected.relationships.map((r) => r['unique-id']));
		const preservedOptions = model.relationships
			.filter((r) => variantOf(r['relationship-type']) === 'options')
			.map((r) => gcDecisions(r, nodeIds, relIds));

		// Merge: graph from the canvas; document-level keys retained from the prior
		// model so a canvas edit doesn't drop flows/metadata/decorators/etc.
		model = {
			...model,
			nodes: [...projected.nodes],
			relationships: [...projected.relationships, ...preservedOptions]
		};
	});
}

/**
 * Drop decisions whose node/relationship references no longer resolve in the
 * post-edit graph. A reference is dangling only when an id is *present but
 * missing* from the graph — empty `nodes`/`relationships` arrays are valid and
 * are kept. Returns a new relationship with the surviving decisions.
 */
function gcDecisions(
	rel: CalmRelationship,
	nodeIds: Set<string>,
	relIds: Set<string>
): CalmRelationship {
	const rt = rel['relationship-type'];
	const decisions = rt.options ?? [];
	const kept = decisions.filter(
		(dec) =>
			(dec.nodes ?? []).every((id) => nodeIds.has(id)) &&
			(dec.relationships ?? []).every((id) => relIds.has(id))
	);
	return { ...rel, 'relationship-type': { ...rt, options: kept } };
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

// ─── Decorator CRUD ───────────────────────────────────────────────────────────

/** Document-level decorators array, never undefined. */
function decoratorList(): CalmDecorator[] {
	return model.decorators ?? [];
}

/** Set the decorators array, dropping the key entirely when empty so a doc
 * with no decorators doesn't gain a noisy `decorators: []`. */
function setDecorators(next: CalmDecorator[]): void {
	if (next.length > 0) {
		model = { ...model, decorators: next };
	} else {
		const { decorators: _omit, ...rest } = model;
		model = rest;
	}
}

/**
 * Merge a list of decorators into the model's decorators, unioning `applies-to`
 * for matching unique-ids (incoming `data`/`target` win). Used on open to fold
 * a `*.decorators.json` sidecar onto any decorators already lifted from the
 * document body, without clobbering one with the other.
 */
export function mergeDecorators(incoming: CalmDecorator[]): void {
	setDecorators(mergeDecoratorLists(decoratorList(), incoming));
}

/**
 * Add or replace a decorator by unique-id (idempotent upsert). Re-binding the
 * same Gemara catalog/control replaces rather than duplicating — mirroring the
 * AIGF governance overlay's merge.
 */
export function upsertDecorator(decorator: CalmDecorator): void {
	const others = decoratorList().filter((d) => d['unique-id'] !== decorator['unique-id']);
	setDecorators([...others, decorator]);
}

/** Remove a decorator by unique-id. */
export function removeDecorator(uniqueId: string): void {
	setDecorators(decoratorList().filter((d) => d['unique-id'] !== uniqueId));
}

/**
 * Remove a single element from a decorator's `applies-to`; delete the decorator
 * entirely when no targets remain. Unbinds a Gemara link from one element
 * without affecting the same binding on other elements.
 */
export function removeDecoratorFromElement(uniqueId: string, elementId: string): void {
	const list = decoratorList();
	const target = list.find((d) => d['unique-id'] === uniqueId);
	if (!target) return;
	const nextApplies = target['applies-to'].filter((id) => id !== elementId);
	if (nextApplies.length === 0) {
		setDecorators(list.filter((d) => d['unique-id'] !== uniqueId));
	} else {
		upsertDecorator({ ...target, 'applies-to': nextApplies });
	}
}

/** All decorators whose `applies-to` includes the given element unique-id. */
export function decoratorsForElement(elementId: string): CalmDecorator[] {
	return decoratorList().filter((d) => d['applies-to'].includes(elementId));
}

// ─── Attestation (CALM controls) ────────────────────────────────────────────

/** An attestation that a Gemara control has been implemented on an element. */
export interface ControlAttestation {
	/** The Gemara control (or requirement) id being attested, e.g. CCC.MARefArc.CN01. */
	controlId: string;
	/** The guideline this control satisfies — groups attestations per guideline. */
	guidelineId?: string;
	/** Durable citation for the control (e.g. its grc.store coordinate). */
	requirementUrl: string;
	name?: string;
	description?: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** A control-detail's `config` object, if present (the detail type is a union). */
function reqConfig(r: unknown): Record<string, unknown> | undefined {
	const cfg = isRecord(r) ? (r as { config?: unknown }).config : undefined;
	return isRecord(cfg) ? cfg : undefined;
}

/**
 * CALM controls key for attestations. Per CALM 1.2, keys must be domain-oriented
 * (NOT framework-prefixed like `aigf-*`/`air-*`); the framework ids (the Gemara
 * control id and the guideline it satisfies) live in `config`.
 */
const ATTESTATION_KEY = 'ai-governance';

/** Merge an attestation into a controls block (idempotent by control-id). */
function applyAttestation(controls: CalmControls | undefined, a: ControlAttestation): CalmControls {
	const key = ATTESTATION_KEY;
	const next: CalmControls = { ...(controls ?? {}) };
	const entry = next[key] ?? {
		description: 'AI governance controls attested as implemented',
		requirements: [],
	};
	const reqs = [...(entry.requirements ?? [])];
	const already = reqs.some((r) => reqConfig(r)?.['control-id'] === a.controlId);
	if (!already) {
		reqs.push({
			'requirement-url': a.requirementUrl,
			config: {
				'control-id': a.controlId,
				attested: true,
				...(a.guidelineId !== undefined ? { 'attested-for': a.guidelineId } : {}),
				...(a.name !== undefined ? { name: a.name } : {}),
				...(a.description !== undefined ? { description: a.description } : {}),
			},
		});
	}
	next[key] = { ...entry, requirements: reqs };
	return next;
}

function removeAttestation(controls: CalmControls | undefined, controlId: string): CalmControls | undefined {
	if (!controls) return undefined;
	const next: CalmControls = {};
	for (const [key, entry] of Object.entries(controls)) {
		const reqs = (entry.requirements ?? []).filter((r) => reqConfig(r)?.['control-id'] !== controlId);
		if (reqs.length > 0) next[key] = { ...entry, requirements: reqs };
	}
	return Object.keys(next).length > 0 ? next : undefined;
}

function nodeControls(nodeId: string): CalmControls | undefined {
	const n = model.nodes.find((x) => x['unique-id'] === nodeId) as { controls?: CalmControls } | undefined;
	return n?.controls;
}

/** Attest a control as implemented on a node (writes node `controls`). */
export function attestControlOnNode(nodeId: string, a: ControlAttestation): void {
	updateNodeProperty(nodeId, 'controls', applyAttestation(nodeControls(nodeId), a));
}

/** Remove a node-level attestation by control-id. */
export function unattestControlOnNode(nodeId: string, controlId: string): void {
	const next = removeAttestation(nodeControls(nodeId), controlId);
	updateNodeProperty(nodeId, 'controls', next ?? {});
}

/** Attest a control at architecture (document) scope. */
export function attestArchControl(a: ControlAttestation): void {
	model = { ...model, controls: applyAttestation((model as { controls?: CalmControls }).controls, a) };
}

/** Whether a control-id is attested on a node. */
export function isControlAttestedOnNode(nodeId: string, controlId: string): boolean {
	const c = nodeControls(nodeId);
	if (!c) return false;
	return Object.values(c).some((entry) =>
		(entry.requirements ?? []).some((r) => reqConfig(r)?.['control-id'] === controlId),
	);
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

export type { CalmArchitecture, CalmDecorator, CalmNode, CalmRelationship, CalmInterface };
