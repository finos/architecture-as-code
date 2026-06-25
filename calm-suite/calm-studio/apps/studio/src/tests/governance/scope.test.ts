// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { rootSystemNodeId, elementScopeChain, topLevelSystemNodeIds } from '$lib/governance/scope';
import type { CalmArchitecture } from '@calmstudio/calm-core';

const arch: CalmArchitecture = {
	nodes: [
		{ 'unique-id': 'mas', 'node-type': 'system', name: 'MAS', description: '' },
		{ 'unique-id': 'agent-layer', 'node-type': 'system', name: 'Agent Layer', description: '' },
		{ 'unique-id': 'agent-runtime', 'node-type': 'service', name: 'Runtime', description: '' },
		{ 'unique-id': 'external', 'node-type': 'actor', name: 'User', description: '' },
	],
	relationships: [
		{ 'unique-id': 'r1', 'relationship-type': { 'composed-of': { container: 'mas', nodes: ['agent-layer'] } } },
		{ 'unique-id': 'r2', 'relationship-type': { 'composed-of': { container: 'agent-layer', nodes: ['agent-runtime'] } } },
	],
};

describe('governance scope', () => {
	it('rootSystemNodeId is the top-level (uncontained) system', () => {
		// agent-layer is also a system, but it's contained by mas, so mas wins.
		expect(rootSystemNodeId(arch)).toBe('mas');
	});

	it('elementScopeChain walks containment ancestors nearest-first', () => {
		expect(elementScopeChain(arch, 'agent-runtime')).toEqual(['agent-runtime', 'agent-layer', 'mas']);
		expect(elementScopeChain(arch, 'mas')).toEqual(['mas']);
		expect(elementScopeChain(arch, 'external')).toEqual(['external']); // uncontained
	});

	it('falls back to the first top-level node when there is no system', () => {
		const noSys: CalmArchitecture = {
			nodes: [{ 'unique-id': 'a', 'node-type': 'service', name: 'A', description: '' }],
			relationships: [],
		};
		expect(rootSystemNodeId(noSys)).toBe('a');
	});

	it('returns null for an empty document', () => {
		expect(rootSystemNodeId({ nodes: [], relationships: [] })).toBeNull();
	});

	it('with multiple peer top-level systems: rootSystemNodeId is the first; topLevelSystemNodeIds lists all', () => {
		const peers: CalmArchitecture = {
			nodes: [
				{ 'unique-id': 'client', 'node-type': 'system', name: 'Client', description: '' },
				{ 'unique-id': 'backend', 'node-type': 'system', name: 'Backend', description: '' },
			],
			relationships: [],
		};
		expect(rootSystemNodeId(peers)).toBe('client'); // documented first-wins
		expect(topLevelSystemNodeIds(peers)).toEqual(['client', 'backend']); // both, for the picker
	});
});
