// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import type { Edge } from '@xyflow/svelte';
import EdgeProperties from '$lib/properties/EdgeProperties.svelte';
import { applyFromJson, resetModel, getModel } from '$lib/stores/calmModel.svelte';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeFlowEdge(id: string, relType: string, source: string, target: string, protocol?: string): Edge {
	return {
		id,
		source,
		target,
		type: relType,
		data: {
			calmRelType: relType,
			description: 'Test edge description',
			protocol: protocol ?? '',
		},
	};
}

beforeEach(() => {
	resetModel();
	applyFromJson({
		nodes: [
			{ 'unique-id': 'svc-1', 'node-type': 'service', name: 'API Service' },
			{ 'unique-id': 'db-1', 'node-type': 'database', name: 'Main DB' },
		],
		relationships: [
			{
				'unique-id': 'rel-1',
				'relationship-type': { connects: { source: { node: 'svc-1' }, destination: { node: 'db-1' } } },
				protocol: 'HTTPS',
				description: 'Test edge description',
			},
		],
	});
});

describe('EdgeProperties', () => {
	it('renders relationship type select with accessible name', () => {
		const { getByRole } = render(EdgeProperties, {
			props: { edge: makeFlowEdge('rel-1', 'connects', 'svc-1', 'db-1', 'HTTPS') },
		});
		// a11y: relationship type select has label "Relationship type"
		const select = getByRole('combobox', { name: /relationship type/i }) as HTMLSelectElement;
		expect(select).toBeTruthy();
		expect(select.value).toBe('connects');
	});

	it('renders source and destination read-only fields', () => {
		const { getByText } = render(EdgeProperties, {
			props: { edge: makeFlowEdge('rel-1', 'connects', 'svc-1', 'db-1', 'HTTPS') },
		});
		// Source and destination shown as text in read-only divs
		expect(getByText('svc-1')).toBeTruthy();
		expect(getByText('db-1')).toBeTruthy();
	});

	it('renders protocol dropdown for connects type edge (a11y)', () => {
		const { getByRole } = render(EdgeProperties, {
			props: { edge: makeFlowEdge('rel-1', 'connects', 'svc-1', 'db-1', 'HTTPS') },
		});
		// Protocol select should render for 'connects' type
		const protocolSelect = getByRole('combobox', { name: /protocol/i }) as HTMLSelectElement;
		expect(protocolSelect).toBeTruthy();
	});

	it('renders description textarea with accessible name', () => {
		const { getByRole } = render(EdgeProperties, {
			props: { edge: makeFlowEdge('rel-1', 'connects', 'svc-1', 'db-1', 'HTTPS') },
		});
		const textarea = getByRole('textbox', { name: /relationship description/i });
		expect(textarea).toBeTruthy();
	});

	it('description textarea is focusable (not disabled)', () => {
		const { getByLabelText } = render(EdgeProperties, {
			props: { edge: makeFlowEdge('rel-1', 'connects', 'svc-1', 'db-1', 'HTTPS') },
		});
		const textarea = getByLabelText(/relationship description/i) as HTMLTextAreaElement;
		expect(textarea.disabled).toBe(false);
	});

	it('does NOT render protocol for deployed-in type edge', () => {
		const { queryByRole } = render(EdgeProperties, {
			props: { edge: makeFlowEdge('rel-2', 'deployed-in', 'svc-1', 'db-1') },
		});
		// Protocol select should NOT be rendered for deployed-in
		const protocolSelect = queryByRole('combobox', { name: /protocol/i });
		expect(protocolSelect).toBeNull();
	});

	it('relationship type select offers exactly the 4 authorable types (no options)', () => {
		const { getByRole } = render(EdgeProperties, {
			props: { edge: makeFlowEdge('rel-1', 'connects', 'svc-1', 'db-1', 'HTTPS') },
		});
		const select = getByRole('combobox', { name: /relationship type/i }) as HTMLSelectElement;
		const options = Array.from(select.options).map((o) => o.value);
		expect(options).toContain('connects');
		expect(options).toContain('interacts');
		expect(options).toContain('deployed-in');
		expect(options).toContain('composed-of');
		// 'options' is intentionally not authorable (no decision UI; would emit invalid CALM).
		expect(options).not.toContain('options');
		expect(options).toHaveLength(4);
	});

	it('renders unique-id in read-only field', () => {
		const { getByText } = render(EdgeProperties, {
			props: { edge: makeFlowEdge('rel-1', 'connects', 'svc-1', 'db-1', 'HTTPS') },
		});
		expect(getByText('rel-1')).toBeTruthy();
	});

	it('edits a multi-child edge via its calmRelId, not the suffixed edge id', async () => {
		// A multi-child relationship's edges have ids `<relId>#<i>`; the underlying
		// relationship in the model is keyed by the un-suffixed `calmRelId`. Editing
		// must resolve via calmRelId or it silently no-ops.
		resetModel();
		applyFromJson({
			nodes: [
				{ 'unique-id': 'box', 'node-type': 'system', name: 'Box', description: 'Box' },
				{ 'unique-id': 'c1', 'node-type': 'service', name: 'C1', description: 'C1' },
				{ 'unique-id': 'c2', 'node-type': 'service', name: 'C2', description: 'C2' },
			],
			relationships: [
				{
					'unique-id': 'box-children',
					'relationship-type': { 'composed-of': { container: 'box', nodes: ['c1', 'c2'] } },
				},
			],
		});
		const edge = {
			id: 'box-children#1',
			source: 'box',
			target: 'c2',
			type: 'composed-of',
			data: { calmRelId: 'box-children', calmVariant: 'composed-of', description: '' },
		} as unknown as Edge;
		const { getByRole } = render(EdgeProperties, { props: { edge } });
		const select = getByRole('combobox', { name: /relationship type/i }) as HTMLSelectElement;
		await fireEvent.change(select, { target: { value: 'interacts' } });

		// The edit must land on 'box-children' (keyed by calmRelId), not the
		// non-existent 'box-children#1'. With the old edit-by-edge.id it no-ops.
		const rt = getModel().relationships.find((r) => r['unique-id'] === 'box-children')?.[
			'relationship-type'
		];
		expect(rt && 'interacts' in rt).toBe(true);
		// Switching the type must PRESERVE all children, not collapse to the edited
		// edge's single child (the original composed-of had c1 AND c2).
		if (rt && 'interacts' in rt) {
			expect(rt.interacts.actor).toBe('box');
			expect(new Set(rt.interacts.nodes)).toEqual(new Set(['c1', 'c2']));
		}
	});
});
