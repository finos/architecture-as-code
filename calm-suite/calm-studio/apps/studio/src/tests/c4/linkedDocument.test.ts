// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { buildLinkedDocument, readC4Level, linkedDocRef } from '$lib/c4/linkedDocument';

describe('linkedDocRef', () => {
	it('derives a bare .arch.json ref from the node id', () => {
		expect(linkedDocRef('user-interaction-layer')).toBe('user-interaction-layer.arch.json');
	});
});

describe('readC4Level', () => {
	it('reads object-form metadata', () => {
		expect(readC4Level({ 'c4-level': 'container' })).toBe('container');
	});
	it('reads array-form metadata', () => {
		expect(readC4Level([{ other: 1 }, { 'c4-level': 'component' }])).toBe('component');
	});
	it('returns undefined for missing/invalid', () => {
		expect(readC4Level(undefined)).toBeUndefined();
		expect(readC4Level({ 'c4-level': 'nope' })).toBeUndefined();
	});
});

describe('buildLinkedDocument', () => {
	const source = { id: 'multi-agent-system', name: 'Multi-Agent System', nodeType: 'system', description: 'root' };

	it('reuses the source node identity in the child root node', () => {
		const { doc } = buildLinkedDocument(source);
		expect(doc.nodes).toHaveLength(1);
		expect(doc.nodes[0]).toMatchObject({
			'unique-id': 'multi-agent-system',
			'node-type': 'system',
			name: 'Multi-Agent System',
			description: 'root',
		});
		expect(doc.relationships).toEqual([]);
	});

	it('refs the child as <id>.arch.json', () => {
		expect(buildLinkedDocument(source).ref).toBe('multi-agent-system.arch.json');
	});

	it('declares the child one C4 level below the parent', () => {
		expect(buildLinkedDocument(source, 'context').doc.metadata).toMatchObject({ 'c4-level': 'container' });
		expect(buildLinkedDocument(source, 'container').doc.metadata).toMatchObject({ 'c4-level': 'component' });
		expect(buildLinkedDocument(source, 'component').doc.metadata).toMatchObject({ 'c4-level': 'component' });
	});

	it('defaults to container when the parent level is unknown', () => {
		expect(buildLinkedDocument(source).doc.metadata).toMatchObject({ 'c4-level': 'container' });
	});

	it('defaults node-type to system and description to empty', () => {
		const { doc } = buildLinkedDocument({ id: 'n', name: 'N', nodeType: '' });
		expect(doc.nodes[0]['node-type']).toBe('system');
		expect(doc.nodes[0].description).toBe('');
	});
});
