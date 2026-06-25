// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach } from 'vitest';
import {
	registerC4DemoSeries,
	registerC4Document,
	resolveC4Document,
	documentHasNode,
	listC4Documents,
	hasC4Documents,
	clearC4Documents,
	C4_DEMO_ROOT_REF,
} from '$lib/c4/c4Documents.svelte';
import { isDrillable, isInteractiveKeyTarget } from '$lib/c4/c4Filter';
import type { Node } from '@xyflow/svelte';
import type { CalmArchitecture } from '@calmstudio/calm-core';

const NS = 'https://calm.finos.org/marefarch';

beforeEach(() => clearC4Documents());

describe('C4 document set', () => {
	it('registers the demo series and resolves the drill chain', () => {
		const root = registerC4DemoSeries();
		expect(hasC4Documents()).toBe(true);
		expect(root.nodes.some((n) => n['unique-id'] === 'multi-agent-system')).toBe(true);

		const layer = resolveC4Document(`${NS}/agent-layer.arch.json`);
		expect(layer?.title).toBe('Agent Layer');
		expect(layer?.level).toBe('container');
		expect(resolveC4Document(`${NS}/agent-runtime.component.arch.json`)?.level).toBe('component');
	});

	it('returns undefined for an unregistered ref, and clears', () => {
		registerC4DemoSeries();
		expect(resolveC4Document('https://example.com/nope.json')).toBeUndefined();
		clearC4Documents();
		expect(hasC4Documents()).toBe(false);
		expect(resolveC4Document(C4_DEMO_ROOT_REF)).toBeUndefined();
	});

	it('re-registration after clear (workspace switch) resolves correctly', () => {
		registerC4DemoSeries();
		clearC4Documents();
		expect(resolveC4Document(C4_DEMO_ROOT_REF)).toBeUndefined();
		registerC4DemoSeries();
		expect(resolveC4Document(C4_DEMO_ROOT_REF)).toBeDefined();
	});

	it('documentHasNode supports the identity-continuity check', () => {
		const doc: CalmArchitecture = {
			nodes: [{ 'unique-id': 'agent-layer', 'node-type': 'system', name: 'X', description: 'y' }],
			relationships: [],
		};
		registerC4Document('ref', doc);
		expect(documentHasNode(resolveC4Document('ref')!.doc, 'agent-layer')).toBe(true);
		expect(documentHasNode(resolveC4Document('ref')!.doc, 'nope')).toBe(false);
	});

	it('listC4Documents returns registered docs (for the link picker)', () => {
		const docOf = (id: string): CalmArchitecture => ({
			nodes: [{ 'unique-id': id, 'node-type': 'system', name: id, description: '' }],
			relationships: [],
		});
		registerC4Document('a.json', docOf('a'));
		registerC4Document('b.json', docOf('b'));
		expect(listC4Documents().map((d) => d.ref).sort()).toEqual(['a.json', 'b.json']);
	});
});

describe('c4Filter — isDrillable (a resolvable link only)', () => {
	const node = (id: string, extra: Record<string, unknown> = {}): Node =>
		({ id, data: { calmId: id, ...extra } }) as unknown as Node;

	it('is drillable when its detailed-architecture link resolves', () => {
		const n = node('a', { details: { 'detailed-architecture': 'ref-x' } });
		expect(isDrillable(n, (r) => r === 'ref-x')).toBe(true);
		expect(isDrillable(n, () => false)).toBe(false); // unresolvable link → not drillable
	});

	it('is NOT drillable via composed-of children — those are visual containment only', () => {
		const parent = node('p'); // has children elsewhere, but no link
		expect(isDrillable(parent, () => false)).toBe(false);
	});

	it('is not drillable with no link', () => {
		expect(isDrillable(node('leaf'), () => true)).toBe(false);
	});
});

describe('c4Filter — isInteractiveKeyTarget', () => {
	it('keeps canvas keys from hijacking focused controls', () => {
		const button = document.createElement('button');
		const span = document.createElement('span');
		button.appendChild(span);
		expect(isInteractiveKeyTarget(button)).toBe(true);
		expect(isInteractiveKeyTarget(span)).toBe(true); // closest('button')
		expect(isInteractiveKeyTarget(document.createElement('div'))).toBe(false);
		expect(isInteractiveKeyTarget(null)).toBe(false);
	});
});
