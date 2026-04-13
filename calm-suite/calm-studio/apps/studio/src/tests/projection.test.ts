// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, test, expect, beforeAll } from 'vitest';
import type { CalmArchitecture } from '@calmstudio/calm-core';
import { calmToFlow, flowToCalm } from '$lib/stores/projection';
import { initAllPacks } from '@calmstudio/extensions';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const actorArch: CalmArchitecture = {
	nodes: [
		{
			'unique-id': 'actor-1',
			'node-type': 'actor',
			name: 'User',
			description: 'The end user',
			interfaces: [{ 'unique-id': 'iface-1', type: 'url', value: 'https://example.com' }],
		},
	],
	relationships: [],
};

const connectsArch: CalmArchitecture = {
	nodes: [
		{ 'unique-id': 'svc-1', 'node-type': 'service', name: 'API' },
		{ 'unique-id': 'db-1', 'node-type': 'database', name: 'DB' },
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

// ─── calmToFlow tests ─────────────────────────────────────────────────────────

describe('calmToFlow', () => {
	test('converts actor node to Svelte Flow Node with correct shape', () => {
		const { nodes, edges } = calmToFlow(actorArch);
		expect(nodes).toHaveLength(1);
		expect(edges).toHaveLength(0);

		const node = nodes[0];
		expect(node.id).toBe('actor-1');
		expect(node.type).toBe('actor');
		expect(node.data.label).toBe('User');
		expect(node.data.calmId).toBe('actor-1');
		expect(node.data.calmType).toBe('actor');
		expect(node.data.description).toBe('The end user');
		expect(node.data.interfaces).toHaveLength(1);
		expect(node.data.interfaces[0]['unique-id']).toBe('iface-1');
		expect(node.data.customMetadata).toEqual({});
	});

	test('assigns default staggered positions for nodes without positionMap', () => {
		const { nodes } = calmToFlow(connectsArch);
		expect(nodes[0].position).toEqual({ x: 100, y: 100 });
		expect(nodes[1].position).toEqual({ x: 260, y: 100 });
	});

	test('converts connects relationship to Svelte Flow Edge', () => {
		const { nodes, edges } = calmToFlow(connectsArch);
		expect(nodes).toHaveLength(2);
		expect(edges).toHaveLength(1);

		const edge = edges[0];
		expect(edge.id).toBe('rel-1');
		expect(edge.source).toBe('svc-1');
		expect(edge.target).toBe('db-1');
		expect(edge.type).toBe('connects');
		expect(edge.data?.protocol).toBe('HTTPS');
		expect(edge.data?.description).toBe('API to DB');
	});

	test('uses positionMap positions for known nodes and staggered default for others', () => {
		const posMap = new Map([['svc-1', { x: 200, y: 300 }]]);
		const { nodes } = calmToFlow(connectsArch, posMap);
		const svc = nodes.find((n) => n.id === 'svc-1')!;
		const db = nodes.find((n) => n.id === 'db-1')!;
		expect(svc.position).toEqual({ x: 200, y: 300 });
		// db-1 is index 1 in the arch, not in posMap → staggered: x = 100 + 1*160 = 260
		expect(db.position).toEqual({ x: 260, y: 100 });
	});
});

// ─── flowToCalm tests ─────────────────────────────────────────────────────────

describe('flowToCalm', () => {
	test('converts Svelte Flow Node back to CalmNode', () => {
		const { nodes, edges } = calmToFlow(actorArch);
		const result = flowToCalm(nodes, edges);
		expect(result.nodes).toHaveLength(1);
		expect(result.relationships).toHaveLength(0);
		const cn = result.nodes[0];
		expect(cn['unique-id']).toBe('actor-1');
		expect(cn['node-type']).toBe('actor');
		expect(cn.name).toBe('User');
	});

	test('maps edge source/target back to relationship source/destination', () => {
		const { nodes, edges } = calmToFlow(connectsArch);
		const result = flowToCalm(nodes, edges);
		expect(result.relationships).toHaveLength(1);
		const rel = result.relationships[0];
		expect(rel['unique-id']).toBe('rel-1');
		expect(rel.source).toBe('svc-1');
		expect(rel.destination).toBe('db-1');
		expect(rel['relationship-type']).toBe('connects');
		expect(rel.protocol).toBe('HTTPS');
	});

	test('round-trip preserves all CALM data (unique-ids, names, types, interfaces, descriptions)', () => {
		const { nodes, edges } = calmToFlow(actorArch);
		const result = flowToCalm(nodes, edges);
		const cn = result.nodes[0];
		expect(cn['unique-id']).toBe('actor-1');
		expect(cn['node-type']).toBe('actor');
		expect(cn.name).toBe('User');
		expect(cn.description).toBe('The end user');
		expect(cn.interfaces).toHaveLength(1);
		expect(cn.interfaces![0]['unique-id']).toBe('iface-1');
		expect(cn.interfaces![0].type).toBe('url');
		expect(cn.interfaces![0].value).toBe('https://example.com');
	});

	test('preserves customMetadata through round-trip', () => {
		const archWithMeta: CalmArchitecture = {
			nodes: [
				{
					'unique-id': 'svc-x',
					'node-type': 'service',
					name: 'MyService',
					customMetadata: { team: 'platform', env: 'prod' },
				},
			],
			relationships: [],
		};
		const { nodes, edges } = calmToFlow(archWithMeta);
		const result = flowToCalm(nodes, edges);
		expect(result.nodes[0].customMetadata).toEqual({ team: 'platform', env: 'prod' });
	});
});

// ─── Extension pack projection tests ──────────────────────────────────────────

describe('extension pack projection', () => {
	beforeAll(() => {
		// Register all packs so resolveNodeType can route colon-prefixed types
		// to the 'extension' key and ExtensionNode can resolve pack metadata.
		initAllPacks();
	});

	test('calmToFlow produces type="extension" and data.calmType="aws:lambda" for pack node', () => {
		const arch: CalmArchitecture = {
			nodes: [{ 'unique-id': 'fn-1', 'node-type': 'aws:lambda', name: 'My Lambda' }],
			relationships: [],
		};
		const { nodes } = calmToFlow(arch);
		expect(nodes).toHaveLength(1);
		const node = nodes[0];
		expect(node.type).toBe('extension');
		expect(node.data.calmType).toBe('aws:lambda');
		expect(node.data.label).toBe('My Lambda');
	});

	test('flowToCalm preserves "aws:lambda" node-type from data.calmType', () => {
		const arch: CalmArchitecture = {
			nodes: [{ 'unique-id': 'fn-1', 'node-type': 'aws:lambda', name: 'My Lambda' }],
			relationships: [],
		};
		const { nodes, edges } = calmToFlow(arch);
		const result = flowToCalm(nodes, edges);
		expect(result.nodes[0]['node-type']).toBe('aws:lambda');
	});

	test('round-trip preserves aws:lambda as node-type string', () => {
		const arch: CalmArchitecture = {
			nodes: [{ 'unique-id': 'fn-2', 'node-type': 'aws:lambda', name: 'Lambda Fn' }],
			relationships: [],
		};
		const { nodes, edges } = calmToFlow(arch);
		const result = flowToCalm(nodes, edges);
		expect(result.nodes[0]['unique-id']).toBe('fn-2');
		expect(result.nodes[0]['node-type']).toBe('aws:lambda');
		expect(result.nodes[0].name).toBe('Lambda Fn');
	});

	test('mixed diagram: core "service" and pack "k8s:pod" both resolve correctly', () => {
		const arch: CalmArchitecture = {
			nodes: [
				{ 'unique-id': 'svc-1', 'node-type': 'service', name: 'API Service' },
				{ 'unique-id': 'pod-1', 'node-type': 'k8s:pod', name: 'API Pod' },
			],
			relationships: [],
		};
		const { nodes } = calmToFlow(arch);
		expect(nodes).toHaveLength(2);

		const svcNode = nodes.find((n) => n.id === 'svc-1')!;
		const podNode = nodes.find((n) => n.id === 'pod-1')!;

		// Core type resolves to its canonical key
		expect(svcNode.type).toBe('service');
		expect(svcNode.data.calmType).toBe('service');

		// Pack type resolves to 'extension' with full calmType preserved
		expect(podNode.type).toBe('extension');
		expect(podNode.data.calmType).toBe('k8s:pod');
	});
});
