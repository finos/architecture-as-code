// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Drives #2551 — generic decorator store + type-aware reverse lookup.
 *
 * RED tests: every assertion here demonstrates a capability needed for the
 * Studio threat-model UI work. They MUST fail before the helpers land and
 * pass after.
 */

import { describe, expect, it } from 'vitest';
import type { CalmArchitecture } from './types.js';
import {
	getDecoratorsByType,
	getDecoratorsForNode,
	getThreatsForNode,
	getControlById,
	type CalmThreatModelDecorator,
	type CalmControlCatalogDecorator,
	type CalmThreat,
} from './decorators.js';

const sampleArch: CalmArchitecture = {
	nodes: [
		{ 'unique-id': 'agent-gateway', 'node-type': 'service', name: 'Gateway', description: 'gw' },
		{ 'unique-id': 'agent-registry', 'node-type': 'service', name: 'Registry', description: 'reg' },
		{ 'unique-id': 'agent-layer', 'node-type': 'system', name: 'Agent Layer', description: 'al' },
		{ 'unique-id': 'unused-node', 'node-type': 'service', name: 'Unused', description: '-' },
	],
	relationships: [],
	decorators: [
		{
			'unique-id': 'tm-control-catalog',
			type: 'control-catalog',
			target: ['arch.calm.json'],
			'applies-to': ['agent-layer'],
			data: {
				framework: 'FINOS MA',
				version: 'apr-2026',
				controls: [
					{ id: 'C8', description: 'Use a Policy-as-Code engine to enforce ABAC.' },
					{ id: 'C9', description: 'Log all critical changes to WORM.' },
					{ id: 'C10', description: 'Implement automated configuration scanning.' },
				],
			},
		},
		{
			'unique-id': 'tm-layer-agent-gateway',
			type: 'threat-model',
			target: ['arch.calm.json'],
			'applies-to': ['agent-gateway', 'agent-registry'],
			data: {
				layer: 'Agent Gateway Layer',
				framework: 'FINOS MA',
				version: 'apr-2026',
				threats: [
					{
						id: 'T-AGL-01',
						name: 'Agent Registry Poisoning',
						description: 'Attacker writes to registry.',
						mitigations: 'Enforce ABAC. Log mutations.',
						controls: ['C8', 'C9', 'C10'],
						'affected-nodes': ['agent-registry'],
					},
					{
						id: 'T-AGL-02',
						name: 'Gateway Bypass',
						description: 'Direct path to agent.',
						mitigations: 'Zero-trust segmentation.',
						controls: ['C8'],
						'affected-nodes': ['agent-gateway'],
					},
				],
			},
		},
	],
};

describe('decorator helpers (#2551)', () => {
	describe('getDecoratorsByType', () => {
		it('returns only decorators matching the given type', () => {
			const threatModels = getDecoratorsByType(sampleArch, 'threat-model');
			expect(threatModels).toHaveLength(1);
			expect(threatModels[0]!['unique-id']).toBe('tm-layer-agent-gateway');
		});

		it('returns empty array when no decorators of that type', () => {
			expect(getDecoratorsByType(sampleArch, 'deployment')).toEqual([]);
		});

		it('returns empty array when arch has no decorators field', () => {
			const empty: CalmArchitecture = { nodes: [], relationships: [] };
			expect(getDecoratorsByType(empty, 'threat-model')).toEqual([]);
		});

		it('finds control-catalog decorators', () => {
			const catalogs = getDecoratorsByType(sampleArch, 'control-catalog');
			expect(catalogs).toHaveLength(1);
			expect(catalogs[0]!['unique-id']).toBe('tm-control-catalog');
		});
	});

	describe('getDecoratorsForNode', () => {
		it('returns decorators where node-id appears in applies-to', () => {
			const result = getDecoratorsForNode(sampleArch, 'agent-gateway');
			const ids = result.map((d) => d['unique-id']);
			expect(ids).toContain('tm-layer-agent-gateway');
		});

		it('returns decorators where node-id appears in data.threats[].affected-nodes', () => {
			const result = getDecoratorsForNode(sampleArch, 'agent-registry');
			const ids = result.map((d) => d['unique-id']);
			expect(ids).toContain('tm-layer-agent-gateway');
		});

		it('returns empty when node is not referenced by any decorator', () => {
			expect(getDecoratorsForNode(sampleArch, 'unused-node')).toEqual([]);
		});

		it('returns empty for missing decorators field', () => {
			const empty: CalmArchitecture = { nodes: [], relationships: [] };
			expect(getDecoratorsForNode(empty, 'any')).toEqual([]);
		});
	});

	describe('getThreatsForNode', () => {
		it('returns only threats whose affected-nodes contains the node id', () => {
			const threats = getThreatsForNode(sampleArch, 'agent-registry');
			expect(threats).toHaveLength(1);
			expect(threats[0]!.id).toBe('T-AGL-01');
		});

		it('returns multiple threats when several reference the node via affected-nodes', () => {
			const archWithMultiple: CalmArchitecture = {
				...sampleArch,
				decorators: [
					{
						'unique-id': 'tm-a',
						type: 'threat-model',
						target: ['arch.calm.json'],
						'applies-to': ['agent-gateway'],
						data: {
							threats: [
								{ id: 'T-1', name: 'X', description: 'x', mitigations: 'm', controls: [], 'affected-nodes': ['agent-gateway'] },
								{ id: 'T-2', name: 'Y', description: 'y', mitigations: 'm', controls: [], 'affected-nodes': ['agent-gateway'] },
							],
						},
					},
				],
			};
			const threats = getThreatsForNode(archWithMultiple, 'agent-gateway');
			expect(threats).toHaveLength(2);
			expect(threats.map((t) => t.id).sort()).toEqual(['T-1', 'T-2']);
		});

		it('falls back to decorator applies-to when individual threats lack affected-nodes', () => {
			const archImpliedAffectsAll: CalmArchitecture = {
				...sampleArch,
				decorators: [
					{
						'unique-id': 'tm-fallback',
						type: 'threat-model',
						target: ['arch.calm.json'],
						'applies-to': ['agent-gateway'],
						data: {
							threats: [
								{ id: 'T-X', name: 'Untargeted', description: 'general', mitigations: 'g', controls: [] },
							],
						},
					},
				],
			};
			const threats = getThreatsForNode(archImpliedAffectsAll, 'agent-gateway');
			expect(threats.map((t) => t.id)).toEqual(['T-X']);
		});

		it('returns empty array for a node not in any threat scope', () => {
			expect(getThreatsForNode(sampleArch, 'unused-node')).toEqual([]);
		});
	});

	describe('getControlById', () => {
		it('looks up control by id from any control-catalog decorator', () => {
			const c = getControlById(sampleArch, 'C8');
			expect(c).toBeDefined();
			expect(c!.description).toContain('ABAC');
		});

		it('returns null when no control matches', () => {
			expect(getControlById(sampleArch, 'C99')).toBeNull();
		});

		it('returns null when no control-catalog decorator exists', () => {
			const empty: CalmArchitecture = { nodes: [], relationships: [] };
			expect(getControlById(empty, 'C8')).toBeNull();
		});
	});

	describe('TypeScript type narrowing', () => {
		it('CalmThreatModelDecorator narrows data.threats[] correctly', () => {
			const decorators = getDecoratorsByType(sampleArch, 'threat-model') as CalmThreatModelDecorator[];
			expect(decorators[0]!.data.threats).toHaveLength(2);
			const t: CalmThreat = decorators[0]!.data.threats[0]!;
			expect(t.id).toBe('T-AGL-01');
			expect(t.controls).toEqual(['C8', 'C9', 'C10']);
		});

		it('CalmControlCatalogDecorator narrows data.controls[] correctly', () => {
			const decorators = getDecoratorsByType(sampleArch, 'control-catalog') as CalmControlCatalogDecorator[];
			expect(decorators[0]!.data.controls).toHaveLength(3);
			expect(decorators[0]!.data.controls[0]!.id).toBe('C8');
		});
	});
});
