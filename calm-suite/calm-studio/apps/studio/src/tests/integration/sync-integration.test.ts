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
import { finalizeCalmForWrite } from '$lib/io/export';

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
		const rt = result.relationships[0]!['relationship-type'];
		expect('connects' in rt).toBe(true);
	});

	it('preserves source and destination through the round-trip', () => {
		const arch = createMinimalArch();
		applyFromJson(arch);

		const { nodes, edges } = calmToFlow(getModel());
		applyFromCanvas(nodes, edges);

		const result = getModel();
		const rt = result.relationships[0]!['relationship-type'];
		if (!('connects' in rt)) throw new Error('expected connects variant');
		expect(rt.connects.source.node).toBe('api-service');
		expect(rt.connects.destination.node).toBe('main-db');
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

// ─── document-level key preservation (cross-tool interop) ─────────────────────

describe('document-level key preservation', () => {
	const SCHEMA_URL = 'https://calm.finos.org/release/1.2/meta/calm.json';

	/** A minimal arch carrying $schema, flows, and doc-level metadata. */
	function fullArch(): CalmArchitecture & { '$schema'?: string } {
		const arch = createMinimalArch({
			flows: [
				{
					'unique-id': 'flow-1',
					name: 'Example flow',
					description: 'An example business flow',
					transitions: [
						{ 'relationship-unique-id': 'api-to-db', 'sequence-number': 1, description: 'call' },
					],
				},
			],
			metadata: { owner: 'platform-team' },
		}) as CalmArchitecture & { '$schema'?: string };
		// $schema is a valid CALM key but isn't on the CalmArchitecture type.
		arch['$schema'] = SCHEMA_URL;
		return arch;
	}

	it('preserves $schema, flows, and metadata through applyFromJson', () => {
		applyFromJson(fullArch());
		const model = getModel() as CalmArchitecture & { '$schema'?: string };
		expect(model['$schema']).toBe(SCHEMA_URL);
		expect(model.flows).toHaveLength(1);
		expect(model.metadata).toEqual({ owner: 'platform-team' });
	});

	it('retains document-level keys through a subsequent canvas edit', () => {
		applyFromJson(fullArch());
		// Simulate a canvas round-trip (e.g. a drag): model -> flow -> model.
		const { nodes, edges } = calmToFlow(getModel());
		applyFromCanvas(nodes, edges);
		const model = getModel() as CalmArchitecture & { '$schema'?: string };
		expect(model['$schema']).toBe(SCHEMA_URL);
		expect(model.flows).toHaveLength(1);
		expect(model.metadata).toEqual({ owner: 'platform-team' });
	});

	it('exposes loaded flows on the model (flow-overlay regression guard)', () => {
		// flowState reads getModel().flows; before this fix it was always
		// undefined for loaded docs, so the flow overlay never worked on open.
		applyFromJson(fullArch());
		expect(getModel().flows).toBeDefined();
		expect(getModel().flows?.[0]['unique-id']).toBe('flow-1');
	});

	it('preserves adrs through applyFromJson and a canvas edit', () => {
		const arch = createMinimalArch({ adrs: ['https://example.com/adrs/001'] });
		applyFromJson(arch);
		const { nodes, edges } = calmToFlow(getModel());
		applyFromCanvas(nodes, edges);
		expect(getModel().adrs).toEqual(['https://example.com/adrs/001']);
	});

	it('preserves document-level controls through applyFromJson and a canvas edit', () => {
		const arch = createMinimalArch({
			controls: {
				'data-residency': {
					description: 'UK only',
					requirements: [
						{ 'requirement-url': 'https://example.com/req', 'config-url': 'https://example.com/cfg' },
					],
				},
			},
		});
		applyFromJson(arch);
		const { nodes, edges } = calmToFlow(getModel());
		applyFromCanvas(nodes, edges);
		expect(getModel().controls?.['data-residency']).toBeDefined();
	});

	it('preserves decorators loaded from a document through a canvas edit', () => {
		const arch = createMinimalArch({
			decorators: [
				{ 'unique-id': 'threat-model-overlay', type: 'threat-model', target: [], 'applies-to': [], data: {} },
			],
		});
		applyFromJson(arch);
		const { nodes, edges } = calmToFlow(getModel());
		applyFromCanvas(nodes, edges);
		expect(getModel().decorators?.find((d) => d['unique-id'] === 'threat-model-overlay')).toBeDefined();
	});

	it('full Save-path composition: getModelJson -> finalizeCalmForWrite -> reparse keeps every doc-level key', () => {
		// Mirrors handleSave/handleSaveAs: serialize the model, finalize for write,
		// then re-parse (as a reopen would). $schema is injected by finalize.
		const arch = createMinimalArch({
			flows: [
				{
					'unique-id': 'f1',
					name: 'Test',
					description: 'Test flow',
					transitions: [
						{ 'relationship-unique-id': 'api-to-db', 'sequence-number': 1, description: 'call' },
					],
				},
			],
			adrs: ['https://example.com/adrs/001'],
			metadata: { owner: 'team-a' },
		});
		applyFromJson(arch);
		const finalJson = finalizeCalmForWrite(getModelJson());
		const result = JSON.parse(finalJson) as CalmArchitecture & { '$schema'?: string };
		expect(result['$schema']).toBe('https://calm.finos.org/release/1.2/meta/calm.json');
		expect(result.flows).toHaveLength(1);
		expect(result.adrs).toEqual(['https://example.com/adrs/001']);
		expect(result.metadata).toEqual({ owner: 'team-a' });
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

// ─── flowToCalm graph fidelity (lossless canvas round-trip) ───────────────────

describe('flowToCalm graph fidelity', () => {
	it('round-trips connects endpoint interfaces', () => {
		const arch: CalmArchitecture = {
			nodes: [
				{ 'unique-id': 'a', 'node-type': 'service', name: 'A', description: 'A' },
				{ 'unique-id': 'b', 'node-type': 'service', name: 'B', description: 'B' }
			],
			relationships: [
				{
					'unique-id': 'a-b',
					'relationship-type': {
						connects: {
							source: { node: 'a', interfaces: ['a-http'] },
							destination: { node: 'b', interfaces: ['b-http'] }
						}
					}
				}
			]
		};
		const { nodes, edges } = calmToFlow(arch);
		const rt = flowToCalm(nodes, edges).relationships[0]['relationship-type'];
		expect(rt.connects?.source.interfaces).toEqual(['a-http']);
		expect(rt.connects?.destination.interfaces).toEqual(['b-http']);
	});

	it('re-aggregates a multi-child composed-of into ONE relationship with the original id', () => {
		const arch: CalmArchitecture = {
			nodes: [
				{ 'unique-id': 'box', 'node-type': 'system', name: 'Box', description: 'Box' },
				{ 'unique-id': 'c1', 'node-type': 'service', name: 'C1', description: 'C1' },
				{ 'unique-id': 'c2', 'node-type': 'service', name: 'C2', description: 'C2' },
				{ 'unique-id': 'c3', 'node-type': 'service', name: 'C3', description: 'C3' }
			],
			relationships: [
				{
					'unique-id': 'box-children',
					'relationship-type': { 'composed-of': { container: 'box', nodes: ['c1', 'c2', 'c3'] } }
				}
			]
		};
		const { nodes, edges } = calmToFlow(arch);
		expect(edges).toHaveLength(3); // expands to one edge per child
		const rels = flowToCalm(nodes, edges).relationships;
		expect(rels).toHaveLength(1); // re-aggregated, not fragmented
		expect(rels[0]['unique-id']).toBe('box-children'); // original id restored
		expect(new Set(rels[0]['relationship-type']['composed-of']?.nodes)).toEqual(
			new Set(['c1', 'c2', 'c3'])
		);
	});

	it('re-aggregates multi-child deployed-in and interacts', () => {
		const arch: CalmArchitecture = {
			nodes: [
				{ 'unique-id': 'host', 'node-type': 'system', name: 'Host', description: 'h' },
				{ 'unique-id': 's1', 'node-type': 'service', name: 'S1', description: 's1' },
				{ 'unique-id': 's2', 'node-type': 'service', name: 'S2', description: 's2' },
				{ 'unique-id': 'actor', 'node-type': 'actor', name: 'Actor', description: 'a' },
				{ 'unique-id': 'x1', 'node-type': 'service', name: 'X1', description: 'x1' },
				{ 'unique-id': 'x2', 'node-type': 'service', name: 'X2', description: 'x2' }
			],
			relationships: [
				{ 'unique-id': 'dep', 'relationship-type': { 'deployed-in': { container: 'host', nodes: ['s1', 's2'] } } },
				{ 'unique-id': 'int', 'relationship-type': { interacts: { actor: 'actor', nodes: ['x1', 'x2'] } } }
			]
		};
		const { nodes, edges } = calmToFlow(arch);
		const rels = flowToCalm(nodes, edges).relationships;
		const dep = rels.find((r) => r['unique-id'] === 'dep');
		const int = rels.find((r) => r['unique-id'] === 'int');
		expect(rels).toHaveLength(2);
		expect(dep?.['relationship-type']['deployed-in']?.container).toBe('host');
		expect(int?.['relationship-type'].interacts?.actor).toBe('actor');
		expect(new Set(dep?.['relationship-type']['deployed-in']?.nodes)).toEqual(new Set(['s1', 's2']));
		expect(new Set(int?.['relationship-type'].interacts?.nodes)).toEqual(new Set(['x1', 'x2']));
	});

	it('does NOT absorb a drawn edge (no calmRelId) into an existing multi-child group', () => {
		// Pins the grouping contract: keying on calmRelId (not source/variant). A
		// user draws box→c3 with no calmRelId; it must become its OWN relationship,
		// not merge into the existing box-children composed-of.
		const base = calmToFlow({
			nodes: [
				{ 'unique-id': 'box', 'node-type': 'system', name: 'Box', description: 'Box' },
				{ 'unique-id': 'c1', 'node-type': 'service', name: 'C1', description: 'C1' },
				{ 'unique-id': 'c2', 'node-type': 'service', name: 'C2', description: 'C2' },
				{ 'unique-id': 'c3', 'node-type': 'service', name: 'C3', description: 'C3' }
			],
			relationships: [
				{ 'unique-id': 'box-children', 'relationship-type': { 'composed-of': { container: 'box', nodes: ['c1', 'c2'] } } }
			]
		});
		const drawn = {
			id: 'drawn-1',
			source: 'box',
			target: 'c3',
			type: 'composed-of',
			data: { calmVariant: 'composed-of' }
		} as (typeof base.edges)[number];
		const rels = flowToCalm(base.nodes, [...base.edges, drawn]).relationships;
		expect(rels).toHaveLength(2);
		expect(new Set(rels.find((r) => r['unique-id'] === 'box-children')?.['relationship-type']['composed-of']?.nodes)).toEqual(
			new Set(['c1', 'c2'])
		);
		expect(rels.find((r) => r['unique-id'] === 'drawn-1')).toBeDefined();
	});

	it('re-aggregates a multi-child composed-of through the full applyFromCanvas path', () => {
		// The pure-function tests above bypass the store; this guards the wiring
		// (flowToCalm result is actually stored re-aggregated, not overridden).
		applyFromJson({
			nodes: [
				{ 'unique-id': 'box', 'node-type': 'system', name: 'Box', description: 'Box' },
				{ 'unique-id': 'c1', 'node-type': 'service', name: 'C1', description: 'C1' },
				{ 'unique-id': 'c2', 'node-type': 'service', name: 'C2', description: 'C2' },
				{ 'unique-id': 'c3', 'node-type': 'service', name: 'C3', description: 'C3' }
			],
			relationships: [
				{ 'unique-id': 'box-children', 'relationship-type': { 'composed-of': { container: 'box', nodes: ['c1', 'c2', 'c3'] } } }
			]
		});
		const { nodes, edges } = calmToFlow(getModel());
		applyFromCanvas(nodes, edges);
		const rels = getModel().relationships;
		expect(rels).toHaveLength(1);
		expect(rels[0]['unique-id']).toBe('box-children');
		expect(new Set(rels[0]['relationship-type']['composed-of']?.nodes)).toEqual(new Set(['c1', 'c2', 'c3']));
	});
});

// ─── options preservation (no edge form; carried via applyFromCanvas + GC) ─────

describe('options preservation through applyFromCanvas', () => {
	function archWithOptions(): CalmArchitecture {
		return {
			nodes: [
				{ 'unique-id': 'a', 'node-type': 'service', name: 'A', description: 'A' },
				{ 'unique-id': 'b', 'node-type': 'service', name: 'B', description: 'B' }
			],
			relationships: [
				{ 'unique-id': 'conn', 'relationship-type': { connects: { source: { node: 'a' }, destination: { node: 'b' } } } },
				{
					'unique-id': 'decision-1',
					'relationship-type': {
						options: [{ description: 'pick a or b', nodes: ['a', 'b'], relationships: ['conn'] }]
					}
				}
			]
		};
	}

	it('preserves a loaded options relationship across a canvas round-trip', () => {
		applyFromJson(archWithOptions());
		const { nodes, edges } = calmToFlow(getModel());
		applyFromCanvas(nodes, edges);
		const opts = getModel().relationships.find((r) => 'options' in r['relationship-type']);
		expect(opts?.['unique-id']).toBe('decision-1');
	});

	it('GCs an options decision whose referenced node/relationship was deleted on canvas', () => {
		applyFromJson(archWithOptions());
		const { nodes, edges } = calmToFlow(getModel());
		// Simulate deleting node 'b' (and its connects edge) on the canvas.
		const nodes2 = nodes.filter((n) => (n.data as { calmId?: string }).calmId !== 'b');
		const edges2 = edges.filter((e) => e.source !== 'b' && e.target !== 'b');
		applyFromCanvas(nodes2, edges2);
		// decision-1 references the now-missing 'b'/'conn' → GC'd → options rel dropped.
		expect(getModel().relationships.find((r) => 'options' in r['relationship-type'])).toBeUndefined();
	});

	it('flowToCalm never emits an options relationship', () => {
		const { nodes, edges } = calmToFlow(archWithOptions());
		const rels = flowToCalm(nodes, edges).relationships;
		expect(rels.some((r) => 'options' in r['relationship-type'])).toBe(false);
	});

	it('GCs only the dangling decision, keeping the surviving one (partial survival)', () => {
		applyFromJson({
			nodes: [{ 'unique-id': 'a', 'node-type': 'service', name: 'A', description: 'A' }],
			relationships: [
				{
					'unique-id': 'opts',
					'relationship-type': {
						options: [
							{ description: 'good', nodes: ['a'], relationships: [] },
							{ description: 'bad', nodes: ['a', 'missing-node'], relationships: [] }
						]
					}
				}
			]
		});
		const { nodes, edges } = calmToFlow(getModel());
		applyFromCanvas(nodes, edges);
		const opts = getModel().relationships.find((r) => 'options' in r['relationship-type']);
		expect(opts?.['relationship-type'].options).toHaveLength(1);
		expect(opts?.['relationship-type'].options?.[0].description).toBe('good');
	});

	it('keeps an options decision with empty nodes/relationships arrays (empty is valid CALM)', () => {
		applyFromJson({
			nodes: [{ 'unique-id': 'a', 'node-type': 'service', name: 'A', description: 'A' }],
			relationships: [
				{ 'unique-id': 'opts', 'relationship-type': { options: [{ description: 'open', nodes: [], relationships: [] }] } }
			]
		});
		const { nodes, edges } = calmToFlow(getModel());
		applyFromCanvas(nodes, edges);
		expect(getModel().relationships.find((r) => 'options' in r['relationship-type'])).toBeDefined();
	});
});
