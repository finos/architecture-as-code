// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

// Integration: walk the REAL reference series through the unified drill the way
// the +page handlers do (resolve a node's detailed-architecture → drill into the
// document), and assert the identity-continuity guarantee holds across the series.

import { describe, it, expect, beforeEach } from 'vitest';
import {
	registerC4DemoSeries,
	resolveC4Document,
	documentHasNode,
	clearC4Documents,
	C4_DEMO_ROOT_REF,
} from '$lib/c4/c4Documents.svelte';
import {
	enterC4,
	drillIntoDocument,
	navigateUpTo,
	getC4Trail,
	getC4Level,
	getActiveDocumentRef,
	resetC4State,
} from '$lib/c4/c4State.svelte';
import type { CalmNode } from '@calmstudio/calm-core';

const NS = 'https://calm.finos.org/marefarch';
const linkOf = (n: CalmNode): string | undefined =>
	(n.details as { 'detailed-architecture'?: string } | undefined)?.['detailed-architecture'];

beforeEach(() => {
	clearC4Documents();
	resetC4State();
});

describe('C4 demo flow (real series, end to end)', () => {
	it('walks Context → Container → Component by resolving real links', () => {
		const root = registerC4DemoSeries();
		const rootDoc = resolveC4Document(C4_DEMO_ROOT_REF)!;
		// Context: the root doc is the editable model, so the root frame's ref is null.
		enterC4(rootDoc.title, rootDoc.level);
		expect(getC4Level()).toBe('context');
		expect(getActiveDocumentRef()).toBeNull();

		// drill agent-layer (handleC4Drill: read link → resolve → drillIntoDocument)
		const agentLayerNode = root.nodes.find((n) => n['unique-id'] === 'agent-layer')!;
		const layerDoc = resolveC4Document(linkOf(agentLayerNode)!)!;
		expect(documentHasNode(layerDoc.doc, 'agent-layer')).toBe(true); // identity continuity
		expect(drillIntoDocument(layerDoc.ref, agentLayerNode.name, layerDoc.level)).toBe('container');
		expect(getActiveDocumentRef()).toBe(layerDoc.ref);

		// drill agent-runtime → component
		const runtimeNode = layerDoc.doc.nodes.find((n) => n['unique-id'] === 'agent-runtime')!;
		const compDoc = resolveC4Document(linkOf(runtimeNode)!)!;
		expect(documentHasNode(compDoc.doc, 'agent-runtime')).toBe(true);
		expect(drillIntoDocument(compDoc.ref, runtimeNode.name, compDoc.level)).toBe('component');

		expect(getC4Trail().map((f) => f.level)).toEqual(['context', 'container', 'component']);
		expect(getC4Trail().map((f) => f.label)).toEqual([
			'Multi-Agent Reference Architecture',
			'Agent Layer',
			'Agent Runtime',
		]);

		// breadcrumb back to the root
		expect(navigateUpTo(0)?.label).toBe('Multi-Agent Reference Architecture');
		expect(getC4Level()).toBe('context');
		expect(getActiveDocumentRef()).toBeNull();
	});

	it('each document declares the C4 level matching its position', () => {
		registerC4DemoSeries();
		expect(resolveC4Document(C4_DEMO_ROOT_REF)!.level).toBe('context');
		expect(resolveC4Document(`${NS}/agent-layer.arch.json`)!.level).toBe('container');
		expect(resolveC4Document(`${NS}/agent-runtime.component.arch.json`)!.level).toBe('component');
	});

	it('identity continuity holds for every link in the series', () => {
		registerC4DemoSeries();
		const seen = new Set<string>();
		const queue = [C4_DEMO_ROOT_REF];
		let checked = 0;
		while (queue.length) {
			const ref = queue.shift()!;
			if (seen.has(ref)) continue;
			seen.add(ref);
			const entry = resolveC4Document(ref);
			expect(entry, `ref resolves: ${ref}`).toBeDefined();
			for (const n of entry!.doc.nodes) {
				const link = linkOf(n);
				if (!link) continue;
				const target = resolveC4Document(link);
				expect(target, `link resolves: ${link}`).toBeDefined();
				expect(documentHasNode(target!.doc, n['unique-id']), `${n['unique-id']} present in ${link}`).toBe(true);
				checked++;
				queue.push(link);
			}
		}
		expect(checked).toBeGreaterThanOrEqual(2);
	});
});
