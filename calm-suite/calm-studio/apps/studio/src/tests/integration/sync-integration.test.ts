// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * sync-integration.test.ts — Bidirectional sync round-trip integration tests.
 *
 * Verifies that:
 *  1. applyFromJson -> calmToFlow -> applyFromCanvas preserves all CALM data
 *  2. Canvas mutations (via addNode-equivalent path) are reflected in getModel()
 *  3. Projection changes are correctly applied back to the model
 *
 * This is the integration smoke-test for the sync engine and projection layer.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { CalmArchitecture } from '@calmstudio/calm-core';
import { createMinimalArch, createAIGovernanceArch } from '@calmstudio/calm-core/test-fixtures';
import {
	applyFromJson,
	applyFromCanvas,
	getModel,
	getModelJson,
	updateNodeProperty,
	resetModel,
} from '$lib/stores/calmModel.svelte';
import { calmToFlow, flowToCalm } from '$lib/stores/projection';

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
	resetModel();
});

// ─── applyFromJson -> projectToCanvas round-trip ──────────────────────────────

describe('applyFromJson -> calmToFlow -> applyFromCanvas round-trip', () => {
	it('preserves node unique-ids through the round-trip', () => {
		const arch = createMinimalArch();
		applyFromJson(arch);

		// Project to canvas
		const model = getModel();
		const { nodes, edges } = calmToFlow(model);

		// Apply canvas state back to model
		applyFromCanvas(nodes, edges);

		const result = getModel();
		const ids = result.nodes.map((n) => n['unique-id']);
		expect(ids).toContain('api-service');
		expect(ids).toContain('main-db');
	});

	it('preserves node-types through the round-trip', () => {
		const arch = createMinimalArch();
		applyFromJson(arch);

		const { nodes, edges } = calmToFlow(getModel());
		applyFromCanvas(nodes, edges);

		const result = getModel();
		const apiNode = result.nodes.find((n) => n['unique-id'] === 'api-service')!;
		expect(apiNode['node-type']).toBe('service');
	});

	it('preserves node names through the round-trip', () => {
		const arch = createMinimalArch();
		applyFromJson(arch);

		const { nodes, edges } = calmToFlow(getModel());
		applyFromCanvas(nodes, edges);

		const result = getModel();
		const dbNode = result.nodes.find((n) => n['unique-id'] === 'main-db')!;
		expect(dbNode.name).toBe('Main DB');
	});

	it('preserves relationship unique-ids through the round-trip', () => {
		const arch = createMinimalArch();
		applyFromJson(arch);

		const { nodes, edges } = calmToFlow(getModel());
		applyFromCanvas(nodes, edges);

		const result = getModel();
		expect(result.relationships).toHaveLength(1);
		expect(result.relationships[0]['unique-id']).toBe('api-to-db');
	});

	it('preserves relationship types through the round-trip', () => {
		const arch = createMinimalArch();
		applyFromJson(arch);

		const { nodes, edges } = calmToFlow(getModel());
		applyFromCanvas(nodes, edges);

		const result = getModel();
		expect(result.relationships[0]['relationship-type']).toBe('connects');
	});

	it('preserves source and destination through the round-trip', () => {
		const arch = createMinimalArch();
		applyFromJson(arch);

		const { nodes, edges } = calmToFlow(getModel());
		applyFromCanvas(nodes, edges);

		const result = getModel();
		const rel = result.relationships[0];
		expect(rel.source).toBe('api-service');
		expect(rel.destination).toBe('main-db');
	});

	it('preserves node descriptions through the round-trip', () => {
		const arch = createMinimalArch();
		applyFromJson(arch);

		const { nodes, edges } = calmToFlow(getModel());
		applyFromCanvas(nodes, edges);

		const result = getModel();
		const apiNode = result.nodes.find((n) => n['unique-id'] === 'api-service')!;
		expect(apiNode.description).toBe('The main API service');
	});

	it('round-trip with AI governance arch preserves all 4 AI nodes', () => {
		const arch = createAIGovernanceArch();
		applyFromJson(arch);

		const { nodes, edges } = calmToFlow(getModel());
		applyFromCanvas(nodes, edges);

		const result = getModel();
		expect(result.nodes).toHaveLength(4);
		const nodeTypes = result.nodes.map((n) => n['node-type']);
		expect(nodeTypes).toContain('ai:llm');
		expect(nodeTypes).toContain('ai:agent');
		expect(nodeTypes).toContain('ai:orchestrator');
		expect(nodeTypes).toContain('ai:vector-store');
	});

	it('round-trip preserves controls on AI nodes', () => {
		const arch = createAIGovernanceArch();
		applyFromJson(arch);

		const { nodes, edges } = calmToFlow(getModel());
		applyFromCanvas(nodes, edges);

		const result = getModel();
		const llm = result.nodes.find((n) => n['unique-id'] === 'ai-llm')!;
		expect(llm.controls).toBeDefined();
		expect(llm.controls!['security-domain']).toBeDefined();
	});
});

// ─── updateNodeProperty -> calmToFlow reflects change ─────────────────────────

describe('updateNodeProperty -> calmToFlow reflects updated value', () => {
	beforeEach(() => {
		applyFromJson(createMinimalArch());
	});

	it('mutated name appears in calmToFlow output', () => {
		updateNodeProperty('api-service', 'name', 'Updated API');
		const { nodes } = calmToFlow(getModel());
		const node = nodes.find((n) => n.id === 'api-service')!;
		expect(node.data.label).toBe('Updated API');
	});

	it('mutated node-type appears in calmToFlow output', () => {
		updateNodeProperty('main-db', 'node-type', 'service');
		const { nodes } = calmToFlow(getModel());
		const node = nodes.find((n) => n.id === 'main-db')!;
		expect(node.data.calmType).toBe('service');
	});
});

// ─── getModelJson round-trip ──────────────────────────────────────────────────

describe('getModelJson round-trip', () => {
	it('getModelJson after applyFromJson produces parseable JSON', () => {
		applyFromJson(createMinimalArch());
		const json = getModelJson();
		expect(() => JSON.parse(json)).not.toThrow();
	});

	it('round-trip via getModelJson preserves node count', () => {
		const arch = createMinimalArch();
		applyFromJson(arch);
		const json = getModelJson();
		const reparsed = JSON.parse(json) as CalmArchitecture;
		expect(reparsed.nodes).toHaveLength(arch.nodes.length);
	});

	it('round-trip via getModelJson preserves relationship count', () => {
		const arch = createMinimalArch();
		applyFromJson(arch);
		const json = getModelJson();
		const reparsed = JSON.parse(json) as CalmArchitecture;
		expect(reparsed.relationships).toHaveLength(arch.relationships.length);
	});
});

// ─── flowToCalm standalone ────────────────────────────────────────────────────

describe('flowToCalm from calmToFlow output', () => {
	it('produces same node count as original arch', () => {
		const arch = createMinimalArch();
		const { nodes, edges } = calmToFlow(arch);
		const result = flowToCalm(nodes, edges);
		expect(result.nodes).toHaveLength(arch.nodes.length);
	});

	it('produces same relationship count as original arch', () => {
		const arch = createMinimalArch();
		const { nodes, edges } = calmToFlow(arch);
		const result = flowToCalm(nodes, edges);
		expect(result.relationships).toHaveLength(arch.relationships.length);
	});
});
