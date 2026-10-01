// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import type { CalmArchitecture } from '@calmstudio/calm-core';
import {
	architectureToMermaid,
	architectureToMermaidMarkdown,
	buildContainmentMap,
	escapeMermaidLabel,
	sanitizeMermaidId,
} from '$lib/io/mermaidExport';

function arch(partial: Partial<CalmArchitecture>): CalmArchitecture {
	return {
		nodes: [],
		relationships: [],
		...partial,
	};
}

describe('sanitizeMermaidId', () => {
	it('keeps simple ids', () => {
		expect(sanitizeMermaidId('api-gateway')).toBe('api_gateway');
		expect(sanitizeMermaidId('apiService')).toBe('apiService');
	});

	it('prefixes ids that start with a digit', () => {
		expect(sanitizeMermaidId('1svc')).toBe('n_1svc');
	});
});

describe('escapeMermaidLabel', () => {
	it('strips quotes and newlines', () => {
		expect(escapeMermaidLabel('Say "hi"\nthere')).toBe("Say 'hi' there");
	});
});

describe('architectureToMermaid', () => {
	it('emits flowchart with nodes and connects edge', () => {
		const a = arch({
			nodes: [
				{
					'unique-id': 'api',
					'node-type': 'service',
					name: 'API',
					description: '',
				},
				{
					'unique-id': 'db',
					'node-type': 'database',
					name: 'DB',
					description: '',
				},
			],
			relationships: [
				{
					'unique-id': 'r1',
					'relationship-type': {
						connects: {
							source: { node: 'api' },
							destination: { node: 'db' },
						},
					},
				},
			],
		});
		const out = architectureToMermaid(a);
		expect(out).toContain('flowchart TB');
		expect(out).toContain('api["API"]');
		expect(out).toContain('db["DB"]');
		expect(out).toContain('api -->|connects| db');
	});

	it('nests composed-of children in a subgraph and skips containment edges', () => {
		const a = arch({
			nodes: [
				{
					'unique-id': 'sys',
					'node-type': 'system',
					name: 'System',
					description: '',
				},
				{
					'unique-id': 'svc',
					'node-type': 'service',
					name: 'Service',
					description: '',
				},
				{
					'unique-id': 'ext',
					'node-type': 'service',
					name: 'External',
					description: '',
				},
			],
			relationships: [
				{
					'unique-id': 'co1',
					'relationship-type': {
						'composed-of': { container: 'sys', nodes: ['svc'] },
					},
				},
				{
					'unique-id': 'c1',
					'relationship-type': {
						connects: {
							source: { node: 'svc' },
							destination: { node: 'ext' },
						},
					},
				},
			],
		});
		const out = architectureToMermaid(a);
		expect(out).toContain('subgraph sys["System"]');
		expect(out).toContain('svc["Service"]');
		expect(out).toContain('ext["External"]');
		expect(out).toContain('svc -->|connects| ext');
		expect(out).not.toMatch(/composed-of/);
		expect(buildContainmentMap(a.relationships).get('sys')).toEqual(['svc']);
	});

	it('emits interacts edges from actor to each node', () => {
		const a = arch({
			nodes: [
				{
					'unique-id': 'user',
					'node-type': 'actor',
					name: 'User',
					description: '',
				},
				{
					'unique-id': 'app',
					'node-type': 'service',
					name: 'App',
					description: '',
				},
			],
			relationships: [
				{
					'unique-id': 'i1',
					'relationship-type': {
						interacts: { actor: 'user', nodes: ['app'] },
					},
				},
			],
		});
		expect(architectureToMermaid(a)).toContain('user -->|interacts| app');
	});

	it('wraps markdown fence for .md export', () => {
		const a = arch({
			nodes: [
				{
					'unique-id': 'n1',
					'node-type': 'service',
					name: 'N1',
					description: '',
				},
			],
		});
		const md = architectureToMermaidMarkdown(a);
		expect(md.startsWith('```mermaid\n')).toBe(true);
		expect(md.trimEnd().endsWith('```')).toBe(true);
		expect(md).toContain('flowchart TB');
		expect(md).toContain('n1["N1"]');
	});
});
