// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * c4Documents.svelte.ts — the C4 document set: a registry of CALM documents
 * keyed by the ref used in `node.details.detailed-architecture`, so drilling a
 * node can resolve and load the linked document.
 *
 * The links are convention-only in CALM (no tool resolves them), so Studio keeps
 * its own in-memory registry. The bundled reference series (multi-agent-ref-arch)
 * is registered via registerC4DemoSeries(); user-authored docs opened in the
 * session can be registered too, so manually-crafted links resolve the same way.
 */

import type { CalmArchitecture } from '@calmstudio/calm-core';
import type { C4Level } from './c4Filter';

import contextDoc from '../reference/multi-agent-ref-arch/context.arch.json';
import userInteractionLayer from '../reference/multi-agent-ref-arch/user-interaction-layer.arch.json';
import agentGatewayLayer from '../reference/multi-agent-ref-arch/agent-gateway-layer.arch.json';
import agentLayer from '../reference/multi-agent-ref-arch/agent-layer.arch.json';
import knowledgeLayer from '../reference/multi-agent-ref-arch/knowledge-layer.arch.json';
import llmLayer from '../reference/multi-agent-ref-arch/llm-layer.arch.json';
import mcpLayer from '../reference/multi-agent-ref-arch/mcp-layer.arch.json';
import evaluationLayer from '../reference/multi-agent-ref-arch/evaluation-layer.arch.json';
import observabilityLayer from '../reference/multi-agent-ref-arch/observability-layer.arch.json';
import agentRuntimeComponent from '../reference/multi-agent-ref-arch/agent-runtime.component.arch.json';

const NS = 'https://calm.finos.org/marefarch';

export interface C4Document {
	/** The ref a node points at via details.detailed-architecture. */
	ref: string;
	/** Display title (the document's anchor node name). */
	title: string;
	/** The document's own declared C4 level (metadata.c4-level), if any. */
	level?: C4Level;
	doc: CalmArchitecture;
}

const documents = $state(new Map<string, C4Document>());

function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** A document's declared C4 level from metadata (object or array form), if valid. */
function readDeclaredLevel(doc: CalmArchitecture): C4Level | undefined {
	const m = (doc as { metadata?: unknown }).metadata;
	const obj = Array.isArray(m) ? Object.assign({}, ...m.filter(isRecord)) : isRecord(m) ? m : {};
	const lvl = (obj as Record<string, unknown>)['c4-level'];
	return lvl === 'context' || lvl === 'container' || lvl === 'component' ? lvl : undefined;
}

/**
 * The document's anchor node name (the container of its first composed-of — i.e.
 * the node this document elaborates), falling back to the first node. Avoids
 * relying on node ordering for the title.
 */
function anchorTitle(doc: CalmArchitecture): string {
	const co = doc.relationships?.find(
		(r) => isRecord(r['relationship-type']) && 'composed-of' in r['relationship-type'],
	);
	const containerId =
		co && isRecord(co['relationship-type'])
			? (co['relationship-type'] as { 'composed-of'?: { container?: string } })['composed-of']?.container
			: undefined;
	const anchor = containerId ? doc.nodes?.find((n) => n['unique-id'] === containerId) : undefined;
	return anchor?.name ?? doc.nodes?.[0]?.name ?? '';
}

/** Register a document so links pointing at `ref` resolve to it. */
export function registerC4Document(ref: string, doc: CalmArchitecture): void {
	const level = readDeclaredLevel(doc);
	documents.set(ref, { ref, title: anchorTitle(doc) || ref, ...(level ? { level } : {}), doc });
}

/** Whether a document contains a node with the given unique-id (identity check). */
export function documentHasNode(doc: CalmArchitecture, nodeId: string): boolean {
	return !!doc.nodes?.some((n) => n['unique-id'] === nodeId);
}

/** Resolve a detailed-architecture ref to a registered document, if known. */
export function resolveC4Document(ref: string): C4Document | undefined {
	return documents.get(ref);
}

/** All registered documents (for the link-authoring picker). */
export function listC4Documents(): C4Document[] {
	return [...documents.values()];
}

/** Whether any documents are registered (a series/demo is active). */
export function hasC4Documents(): boolean {
	return documents.size > 0;
}

/** Clear the registry (e.g. when leaving the demo or loading a new workspace). */
export function clearC4Documents(): void {
	documents.clear();
}

/** The bundled reference series, keyed by canonical ref. */
const DEMO_SERIES: Array<[string, CalmArchitecture]> = [
	[`${NS}/context.arch.json`, contextDoc as CalmArchitecture],
	[`${NS}/user-interaction-layer.arch.json`, userInteractionLayer as CalmArchitecture],
	[`${NS}/agent-gateway-layer.arch.json`, agentGatewayLayer as CalmArchitecture],
	[`${NS}/agent-layer.arch.json`, agentLayer as CalmArchitecture],
	[`${NS}/knowledge-layer.arch.json`, knowledgeLayer as CalmArchitecture],
	[`${NS}/llm-layer.arch.json`, llmLayer as CalmArchitecture],
	[`${NS}/mcp-layer.arch.json`, mcpLayer as CalmArchitecture],
	[`${NS}/evaluation-layer.arch.json`, evaluationLayer as CalmArchitecture],
	[`${NS}/observability-layer.arch.json`, observabilityLayer as CalmArchitecture],
	[`${NS}/agent-runtime.component.arch.json`, agentRuntimeComponent as CalmArchitecture],
];

/** Canonical ref of the demo's entry (Context) document. */
export const C4_DEMO_ROOT_REF = `${NS}/context.arch.json`;

/**
 * Register the bundled multi-agent reference series and return the Context
 * document to load onto the canvas.
 */
export function registerC4DemoSeries(): CalmArchitecture {
	for (const [ref, doc] of DEMO_SERIES) registerC4Document(ref, doc);
	return contextDoc as CalmArchitecture;
}
