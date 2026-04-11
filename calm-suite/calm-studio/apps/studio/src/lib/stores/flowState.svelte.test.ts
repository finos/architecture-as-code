// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, afterEach } from 'vitest';
import {
	getActiveFlowId,
	setActiveFlowId,
	getActiveFlowEdgeIds,
	getFlowTransitionForEdge,
	isNodeInActiveFlow,
} from './flowState.svelte';
import type { CalmArchitecture } from '@calmstudio/calm-core';

// ─── Test fixture ────────────────────────────────────────────────────────────

const testArch: CalmArchitecture = {
	nodes: [
		{ 'unique-id': 'node-a', 'node-type': 'service', name: 'Service A', description: 'A' },
		{ 'unique-id': 'node-b', 'node-type': 'service', name: 'Service B', description: 'B' },
		{ 'unique-id': 'node-c', 'node-type': 'database', name: 'DB C', description: 'C' },
	],
	relationships: [
		{
			'unique-id': 'rel-1',
			'relationship-type': 'connects',
			source: 'node-a',
			destination: 'node-b',
		},
		{
			'unique-id': 'rel-2',
			'relationship-type': 'connects',
			source: 'node-b',
			destination: 'node-c',
		},
	],
	flows: [
		{
			'unique-id': 'flow-login',
			name: 'Login Flow',
			description: 'User login sequence',
			transitions: [
				{
					'relationship-unique-id': 'rel-1',
					'sequence-number': 1,
					summary: 'A sends request to B',
					direction: 'source-to-destination',
				},
				{
					'relationship-unique-id': 'rel-2',
					'sequence-number': 2,
					summary: 'B queries database',
					direction: 'source-to-destination',
				},
			],
		},
	],
};

// ─── Tests ───────────────────────────────────────────────────────────────────

afterEach(() => {
	// Always reset flow state between tests
	setActiveFlowId(null);
});

describe('flowState store', () => {
	it('Test 1: getActiveFlowId() returns null initially', () => {
		expect(getActiveFlowId()).toBeNull();
	});

	it('Test 2: setActiveFlowId() updates getActiveFlowId()', () => {
		setActiveFlowId('flow-login');
		expect(getActiveFlowId()).toBe('flow-login');
	});

	it('Test 3: setActiveFlowId(null) clears the active flow', () => {
		setActiveFlowId('flow-login');
		setActiveFlowId(null);
		expect(getActiveFlowId()).toBeNull();
	});

	it('Test 4: getActiveFlowEdgeIds() returns empty Set when no active flow', () => {
		const ids = getActiveFlowEdgeIds(testArch);
		expect(ids).toBeInstanceOf(Set);
		expect(ids.size).toBe(0);
	});

	it("Test 5: getActiveFlowEdgeIds() returns Set of relationship-unique-ids for active flow's transitions", () => {
		setActiveFlowId('flow-login');
		const ids = getActiveFlowEdgeIds(testArch);
		expect(ids.size).toBe(2);
		expect(ids.has('rel-1')).toBe(true);
		expect(ids.has('rel-2')).toBe(true);
	});

	it('Test 6: getFlowTransitionForEdge() returns transition for edge in active flow', () => {
		setActiveFlowId('flow-login');
		const t = getFlowTransitionForEdge(testArch, 'rel-1');
		expect(t).not.toBeNull();
		expect(t!['sequence-number']).toBe(1);
		expect(t!.summary).toBe('A sends request to B');
	});

	it('Test 6b: getFlowTransitionForEdge() returns null for edge NOT in active flow', () => {
		setActiveFlowId('flow-login');
		const t = getFlowTransitionForEdge(testArch, 'rel-99');
		expect(t).toBeNull();
	});

	it('Test 6c: getFlowTransitionForEdge() returns null when no active flow', () => {
		const t = getFlowTransitionForEdge(testArch, 'rel-1');
		expect(t).toBeNull();
	});

	it('Test 7: isNodeInActiveFlow() returns true when no flow is active', () => {
		expect(isNodeInActiveFlow(testArch, 'node-a')).toBe(true);
		expect(isNodeInActiveFlow(testArch, 'node-c')).toBe(true);
	});

	it('Test 7b: isNodeInActiveFlow() returns true for nodes connected by active flow edges', () => {
		setActiveFlowId('flow-login');
		// node-a is source of rel-1, node-b is destination of rel-1 and source of rel-2
		// node-c is destination of rel-2 — all are in the flow
		expect(isNodeInActiveFlow(testArch, 'node-a')).toBe(true);
		expect(isNodeInActiveFlow(testArch, 'node-b')).toBe(true);
		expect(isNodeInActiveFlow(testArch, 'node-c')).toBe(true);
	});
});
