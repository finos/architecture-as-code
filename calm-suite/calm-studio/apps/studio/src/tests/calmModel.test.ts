// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, test, expect, beforeEach } from 'vitest';
import type { Node, Edge } from '@xyflow/svelte';
import type { CalmArchitecture, CalmInterface } from '@calmstudio/calm-core';
import {
	applyFromJson,
	applyFromCanvas,
	getModel,
	getModelJson,
	updateNodeProperty,
	updateEdgeProperty,
	addInterface,
	removeInterface,
	updateInterface,
	addCustomMetadata,
	removeCustomMetadata,
	resetModel,
} from '$lib/stores/calmModel.svelte';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const baseArch: CalmArchitecture = {
	nodes: [
		{
			'unique-id': 'svc-1',
			'node-type': 'service',
			name: 'API Service',
			description: 'Backend API',
			interfaces: [{ 'unique-id': 'iface-1', type: 'url', value: 'https://api.example.com' }],
		},
		{
			'unique-id': 'db-1',
			'node-type': 'database',
			name: 'Main DB',
		},
	],
	relationships: [
		{
			'unique-id': 'rel-1',
			'relationship-type': 'connects',
			source: 'svc-1',
			destination: 'db-1',
			protocol: 'HTTPS',
			description: 'API to DB',
		},
	],
};

function makeNode(id: string, calmId: string, calmType: string): Node {
	return {
		id,
		type: calmType,
		position: { x: 0, y: 0 },
		data: { label: id, calmId, calmType },
	};
}

// ─── Direction Mutex tests ────────────────────────────────────────────────────

describe('direction mutex', () => {
	beforeEach(() => {
		resetModel();
	});

	test('applyFromJson returns true on normal call', () => {
		const result = applyFromJson(baseArch);
		expect(result).toBe(true);
	});

	test('applyFromCanvas returns true on normal call', () => {
		const nodes: Node[] = [makeNode('n1', 'svc-1', 'service')];
		const edges: Edge[] = [];
		const result = applyFromCanvas(nodes, edges);
		expect(result).toBe(true);
	});
});

// ─── Model CRUD tests ─────────────────────────────────────────────────────────

describe('model CRUD', () => {
	beforeEach(() => {
		resetModel();
	});

	test('applyFromJson sets model and getModel returns it', () => {
		applyFromJson(baseArch);
		const model = getModel();
		expect(model.nodes).toHaveLength(2);
		expect(model.relationships).toHaveLength(1);
		expect(model.nodes[0]['unique-id']).toBe('svc-1');
	});

	test('getModelJson returns JSON stringified model with 2-space indent', () => {
		applyFromJson(baseArch);
		const json = getModelJson();
		const parsed = JSON.parse(json);
		expect(parsed.nodes).toHaveLength(2);
		expect(json).toContain('\n  ');
	});

	test('resetModel clears to empty architecture', () => {
		applyFromJson(baseArch);
		resetModel();
		const model = getModel();
		expect(model.nodes).toHaveLength(0);
		expect(model.relationships).toHaveLength(0);
	});

	test('applyFromCanvas converts nodes/edges to CalmArchitecture via flowToCalm', () => {
		const nodes: Node[] = [
			{
				id: 'n1',
				type: 'service',
				position: { x: 0, y: 0 },
				data: { label: 'SvcA', calmId: 'svc-a', calmType: 'service' },
			},
		];
		const edges: Edge[] = [];
		applyFromCanvas(nodes, edges);
		const model = getModel();
		expect(model.nodes).toHaveLength(1);
		expect(model.nodes[0]['unique-id']).toBe('svc-a');
		expect(model.nodes[0].name).toBe('SvcA');
	});
});

// ─── Node property mutations ──────────────────────────────────────────────────

describe('node property mutations', () => {
	beforeEach(() => {
		resetModel();
		applyFromJson(baseArch);
	});

	test('updateNodeProperty updates name field', () => {
		updateNodeProperty('svc-1', 'name', 'Updated Service');
		const model = getModel();
		const node = model.nodes.find((n) => n['unique-id'] === 'svc-1')!;
		expect(node.name).toBe('Updated Service');
	});

	test('updateNodeProperty updates description field', () => {
		updateNodeProperty('svc-1', 'description', 'New description');
		const node = getModel().nodes.find((n) => n['unique-id'] === 'svc-1')!;
		expect(node.description).toBe('New description');
	});

	test('updateNodeProperty changes node-type', () => {
		updateNodeProperty('svc-1', 'node-type', 'database');
		const node = getModel().nodes.find((n) => n['unique-id'] === 'svc-1')!;
		expect(node['node-type']).toBe('database');
	});
});

// ─── Edge property mutations ──────────────────────────────────────────────────

describe('edge property mutations', () => {
	beforeEach(() => {
		resetModel();
		applyFromJson(baseArch);
	});

	test('updateEdgeProperty updates protocol field', () => {
		updateEdgeProperty('rel-1', 'protocol', 'gRPC');
		const rel = getModel().relationships.find((r) => r['unique-id'] === 'rel-1')!;
		expect(rel.protocol).toBe('gRPC');
	});

	test('updateEdgeProperty updates description field', () => {
		updateEdgeProperty('rel-1', 'description', 'Updated desc');
		const rel = getModel().relationships.find((r) => r['unique-id'] === 'rel-1')!;
		expect(rel.description).toBe('Updated desc');
	});

	test('updateEdgeProperty changes relationship-type', () => {
		updateEdgeProperty('rel-1', 'relationship-type', 'interacts');
		const rel = getModel().relationships.find((r) => r['unique-id'] === 'rel-1')!;
		expect(rel['relationship-type']).toBe('interacts');
	});
});

// ─── Interface CRUD ───────────────────────────────────────────────────────────

describe('interface CRUD', () => {
	beforeEach(() => {
		resetModel();
		applyFromJson(baseArch);
	});

	test('addInterface adds to node interfaces array', () => {
		const newIface: CalmInterface = { 'unique-id': 'iface-2', type: 'host-port', value: '8080' };
		addInterface('svc-1', newIface);
		const node = getModel().nodes.find((n) => n['unique-id'] === 'svc-1')!;
		expect(node.interfaces).toHaveLength(2);
		expect(node.interfaces![1]['unique-id']).toBe('iface-2');
	});

	test('removeInterface removes by interfaceId', () => {
		removeInterface('svc-1', 'iface-1');
		const node = getModel().nodes.find((n) => n['unique-id'] === 'svc-1')!;
		expect(node.interfaces).toHaveLength(0);
	});

	test('updateInterface updates type and value fields', () => {
		updateInterface('svc-1', 'iface-1', { type: 'host-port', value: '9090' });
		const node = getModel().nodes.find((n) => n['unique-id'] === 'svc-1')!;
		const iface = node.interfaces![0];
		expect(iface.type).toBe('host-port');
		expect(iface.value).toBe('9090');
	});

	test('addInterface to node with no interfaces initializes the array', () => {
		const newIface: CalmInterface = { 'unique-id': 'iface-db-1', type: 'port', value: '5432' };
		addInterface('db-1', newIface);
		const node = getModel().nodes.find((n) => n['unique-id'] === 'db-1')!;
		expect(node.interfaces).toHaveLength(1);
		expect(node.interfaces![0]['unique-id']).toBe('iface-db-1');
	});
});

// ─── Custom metadata ──────────────────────────────────────────────────────────

describe('custom metadata', () => {
	beforeEach(() => {
		resetModel();
		applyFromJson(baseArch);
	});

	test('addCustomMetadata adds key-value to node customMetadata', () => {
		addCustomMetadata('svc-1', 'team', 'platform');
		const node = getModel().nodes.find((n) => n['unique-id'] === 'svc-1')!;
		expect(node.customMetadata).toBeDefined();
		expect(node.customMetadata!['team']).toBe('platform');
	});

	test('removeCustomMetadata removes key from customMetadata', () => {
		addCustomMetadata('svc-1', 'team', 'platform');
		addCustomMetadata('svc-1', 'env', 'prod');
		removeCustomMetadata('svc-1', 'team');
		const node = getModel().nodes.find((n) => n['unique-id'] === 'svc-1')!;
		expect(node.customMetadata!['team']).toBeUndefined();
		expect(node.customMetadata!['env']).toBe('prod');
	});
});
