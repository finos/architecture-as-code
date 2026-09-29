// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, test } from 'vitest';
import type { Node, Edge } from '@xyflow/svelte';
import {
	hubNodeInsertHref,
	resolveDefiningHref,
	type DefiningChainDocument,
} from '$lib/explorer/definingHref';
import { addNeighborsToCanvas } from '$lib/neighbors/addNeighbors';
import { collectNeighborsFromArchitecture } from '$lib/neighbors/findNeighbors';
import type { CalmArchitecture } from '@calmstudio/calm-core';

function doc(id: string, nodes: DefiningChainDocument['nodes']): DefiningChainDocument {
	return { id, nodes };
}

describe('resolveDefiningHref', () => {
	const files = new Map<string, DefiningChainDocument>([
		[
			'org/a/def.json',
			doc('org/a/def.json', [{ uniqueId: 'coa' }]),
		],
		[
			'org/b/stub.json',
			doc('org/b/stub.json', [
				{ uniqueId: 'coa', detailedArchitecture: '../a/def.json' },
			]),
		],
		[
			'org/c/mid.json',
			doc('org/c/mid.json', [
				{ uniqueId: 'coa', detailedArchitecture: '../b/stub.json' },
			]),
		],
	]);

	function load(path: string): DefiningChainDocument | null {
		return files.get(path) ?? null;
	}

	test('follows the chain and rewrites the path from the current file', () => {
		const href = resolveDefiningHref({
			source: files.get('org/c/mid.json')!,
			nodeUniqueId: 'coa',
			currentFile: 'views/overview.json',
			load,
		});
		expect(href).toBe('../org/a/def.json');
	});

	test('copies an http link and does not follow it', () => {
		const href = resolveDefiningHref({
			source: doc('org/b/stub.json', [
				{ uniqueId: 'coa', detailedArchitecture: 'http://localhost:8080/calm/namespaces/onebank/architectures/1' },
			]),
			nodeUniqueId: 'coa',
			currentFile: 'views/overview.json',
			load: () => {
				throw new Error('must not load');
			},
		});
		expect(href).toBe('http://localhost:8080/calm/namespaces/onebank/architectures/1');
	});

	test('falls back to the source file when the next file is missing', () => {
		const href = resolveDefiningHref({
			source: doc('org/b/stub.json', [
				{ uniqueId: 'coa', detailedArchitecture: '../missing/def.json' },
			]),
			nodeUniqueId: 'coa',
			currentFile: 'views/overview.json',
			load: () => null,
		});
		expect(href).toBe('../org/b/stub.json');
	});

	test('falls back to the source file on a cycle', () => {
		const cycle = new Map<string, DefiningChainDocument>([
			['a/one.json', doc('a/one.json', [{ uniqueId: 'coa', detailedArchitecture: 'two.json' }])],
			['a/two.json', doc('a/two.json', [{ uniqueId: 'coa', detailedArchitecture: 'one.json' }])],
		]);
		const href = resolveDefiningHref({
			source: cycle.get('a/one.json')!,
			nodeUniqueId: 'coa',
			currentFile: 'views/overview.json',
			load: (path) => cycle.get(path) ?? null,
		});
		expect(href).toBe('../a/one.json');
	});

	test('falls back when the relative path leaves the project', () => {
		const href = resolveDefiningHref({
			source: doc('stub.json', [{ uniqueId: 'coa', detailedArchitecture: '../outside.json' }]),
			nodeUniqueId: 'coa',
			currentFile: 'views/overview.json',
			load: () => {
				throw new Error('must not load');
			},
		});
		expect(href).toBe('../stub.json');
	});

	test('a node with no detailed-architecture is defined by its own file', () => {
		const href = resolveDefiningHref({
			source: doc('org/a/def.json', [{ uniqueId: 'coa' }]),
			nodeUniqueId: 'coa',
			currentFile: 'org/a/other.json',
			load,
		});
		expect(href).toBe('def.json');
	});
});

describe('hubNodeInsertHref', () => {
	const version = 'http://localhost:8080/calm/namespaces/onebank/architectures/coa/versions/1';

	test('uses the version URL when the node is defined in that document', () => {
		expect(hubNodeInsertHref(version)).toBe(version);
		expect(hubNodeInsertHref(version, '')).toBe(version);
	});

	test('copies an http detailed-architecture', () => {
		expect(hubNodeInsertHref(version, 'https://hub.example/calm/other')).toBe(
			'https://hub.example/calm/other'
		);
	});

	test('falls back to the version URL when the hub node has a relative link', () => {
		expect(hubNodeInsertHref(version, '../local/def.json')).toBe(version);
	});
});

describe('find neighbors insert', () => {
	test('points at the defining file, not the file that only references the node', () => {
		const stub: CalmArchitecture = {
			nodes: [
				{
					'unique-id': 'focus',
					'node-type': 'service',
					name: 'Focus',
					description: '',
				},
				{
					'unique-id': 'coa',
					'node-type': 'system',
					name: 'COA',
					description: '',
					details: { 'detailed-architecture': '../a/def.json' },
				},
			],
			relationships: [
				{
					'unique-id': 'rel-1',
					'relationship-type': {
						connects: {
							source: { node: 'focus' },
							destination: { node: 'coa' },
						},
					},
				},
			],
		};
		const documents = new Map<string, DefiningChainDocument>([
			[
				'org/b/stub.json',
				doc('org/b/stub.json', [
					{ uniqueId: 'focus' },
					{ uniqueId: 'coa', detailedArchitecture: '../a/def.json' },
				]),
			],
			['org/a/def.json', doc('org/a/def.json', [{ uniqueId: 'coa' }])],
		]);
		const hits = collectNeighborsFromArchitecture(
			stub,
			'focus',
			'org/b/stub.json',
			undefined,
			documents
		);
		const nodes: Node[] = [
			{
				id: 'focus',
				position: { x: 0, y: 0 },
				data: { calmId: 'focus', calmType: 'service', label: 'Focus' },
			},
		];
		const result = addNeighborsToCanvas({
			hits,
			nodes,
			edges: [] as Edge[],
			focusUniqueId: 'focus',
			currentRelativePath: 'views/overview.json',
		});
		const ref = result.nodes.find((n) => n.id === 'coa');
		expect((ref?.data?.calmDetails as Record<string, string>)?.['detailed-architecture']).toBe(
			'../org/a/def.json'
		);
	});
});
