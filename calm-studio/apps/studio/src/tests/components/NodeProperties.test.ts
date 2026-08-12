// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import type { Node } from '@xyflow/svelte';
import NodeProperties from '$lib/properties/NodeProperties.svelte';
import { applyFromJson, resetModel } from '$lib/stores/calmModel.svelte';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeFlowNode(id: string, calmType: string, label: string, description: string): Node {
	return {
		id,
		type: calmType,
		position: { x: 0, y: 0 },
		data: {
			label,
			calmId: id,
			calmType,
			description,
		},
	};
}

beforeEach(() => {
	resetModel();
	applyFromJson({
		nodes: [
			{
				'unique-id': 'svc-1',
				'node-type': 'service',
				name: 'API Service',
				description: 'Backend API',
			},
		],
		relationships: [],
	});
});

describe('NodeProperties', () => {
	it('renders node name in a labelled text input', () => {
		const { getByLabelText } = render(NodeProperties, {
			props: { node: makeFlowNode('svc-1', 'service', 'API Service', 'Backend API') },
		});
		const input = getByLabelText(/node name/i) as HTMLInputElement;
		expect(input.value).toBe('API Service');
	});

	it('name input accessible via getByRole textbox with accessible name', () => {
		const { getByRole } = render(NodeProperties, {
			props: { node: makeFlowNode('svc-1', 'service', 'API Service', 'Backend API') },
		});
		// a11y: input must be discoverable by role + accessible name
		const input = getByRole('textbox', { name: /node name/i });
		expect(input).toBeTruthy();
	});

	it('renders node description in a labelled textarea', () => {
		const { getByLabelText } = render(NodeProperties, {
			props: { node: makeFlowNode('svc-1', 'service', 'API Service', 'Backend API') },
		});
		const textarea = getByLabelText(/node description/i) as HTMLTextAreaElement;
		expect(textarea.value).toBe('Backend API');
	});

	it('description textarea accessible via getByRole textbox', () => {
		const { getByRole } = render(NodeProperties, {
			props: { node: makeFlowNode('svc-1', 'service', 'API Service', 'Backend API') },
		});
		expect(getByRole('textbox', { name: /node description/i })).toBeTruthy();
	});

	it('renders node-type select dropdown with aria-label', () => {
		const { getByRole } = render(NodeProperties, {
			props: { node: makeFlowNode('svc-1', 'service', 'API Service', 'Backend API') },
		});
		// a11y: select must have accessible name "Node type"
		const select = getByRole('combobox', { name: /node type/i }) as HTMLSelectElement;
		expect(select).toBeTruthy();
		expect(select.value).toBe('service');
	});

	it('renders the unique-id read-only field with node calmId', () => {
		const { getByText } = render(NodeProperties, {
			props: { node: makeFlowNode('svc-1', 'service', 'API Service', 'Backend API') },
		});
		// unique-id shown as text in the read-only div
		expect(getByText('svc-1')).toBeTruthy();
	});

	it('name input is focusable (not disabled)', () => {
		const { getByLabelText } = render(NodeProperties, {
			props: { node: makeFlowNode('svc-1', 'service', 'API Service', 'Backend API') },
		});
		const input = getByLabelText(/node name/i) as HTMLInputElement;
		expect(input.disabled).toBe(false);
	});

	it('description textarea is focusable (not disabled)', () => {
		const { getByLabelText } = render(NodeProperties, {
			props: { node: makeFlowNode('svc-1', 'service', 'API Service', 'Backend API') },
		});
		const textarea = getByLabelText(/node description/i) as HTMLTextAreaElement;
		expect(textarea.disabled).toBe(false);
	});

	it('renders different node types from data (database)', () => {
		resetModel();
		applyFromJson({
			nodes: [{ 'unique-id': 'db-1', 'node-type': 'database', name: 'Main DB', description: '' }],
			relationships: [],
		});
		const { getByRole } = render(NodeProperties, {
			props: { node: makeFlowNode('db-1', 'database', 'Main DB', '') },
		});
		const select = getByRole('combobox', { name: /node type/i }) as HTMLSelectElement;
		expect(select.value).toBe('database');
	});

	it('disables editable fields for reference nodes (R18)', () => {
		const refNode: Node = {
			id: 'ref-1',
			type: 'extension',
			position: { x: 0, y: 0 },
			data: {
				label: 'API Gateway',
				calmId: 'ref-1',
				calmType: 'archimate:applicationComponent',
				description: 'Reference',
				isReference: true,
				calmDetails: { 'detailed-architecture': '../arch/api.json' },
			},
		};
		const { getByLabelText, getByText, getByRole } = render(NodeProperties, {
			props: { node: refNode, onmutate: () => {}, onopenreference: () => {} },
		});
		expect(getByText(/referenční uzel/i)).toBeTruthy();
		expect(getByText('../arch/api.json')).toBeTruthy();
		expect((getByLabelText(/node name/i) as HTMLInputElement).disabled).toBe(true);
		expect(getByRole('button', { name: /otevřít zdroj/i })).toBeTruthy();
	});

	it('shows metadata section for archimate nodes', () => {
		const archNode: Node = {
			id: 'arch-1',
			type: 'extension',
			position: { x: 0, y: 0 },
			data: {
				label: 'Service',
				calmId: 'arch-1',
				calmType: 'archimate:applicationService',
				description: 'App service',
				metadata: {
					owner: 'TBD',
					archimate: {
						layer: 'Application',
						element: 'archimate:applicationService',
						viewpoint: 'ApplicationCooperation',
					},
				},
			},
		};
		const { getByText, getByLabelText } = render(NodeProperties, {
			props: { node: archNode, onmutate: () => {} },
		});
		expect(getByText('Metadata')).toBeTruthy();
		expect((getByLabelText(/owner/i) as HTMLInputElement).value).toBe('TBD');
	});
});
