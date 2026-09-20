// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
	mapMovedPath,
	planFolderMoveRewrites,
	posixRelative,
	retargetOpenDocumentAfterMove,
	rewriteDetailedArchitectureHref,
} from '$lib/explorer/rewriteDetailedArchitecture';

describe('rewriteDetailedArchitecture', () => {
	it('maps paths under the moved prefix', () => {
		expect(mapMovedPath('org/a/x.json', 'org/a', 'org/b')).toBe('org/b/x.json');
		expect(mapMovedPath('org/c.json', 'org/a', 'org/b')).toBe('org/c.json');
	});

	it('computes posix relative paths', () => {
		expect(posixRelative('org/c', 'org/b/x.json')).toBe('../b/x.json');
		expect(posixRelative('org/b', 'org/b/x.json')).toBe('x.json');
		expect(posixRelative('', 'org/b/x.json')).toBe('org/b/x.json');
	});

	it('rewrites inbound links from files outside the moved tree', () => {
		expect(
			rewriteDetailedArchitectureHref('a/x.json', 'org/c.json', 'org/c.json', 'org/a', 'org/b')
		).toBe('b/x.json');
	});

	it('rewrites outbound links from moved files', () => {
		expect(
			rewriteDetailedArchitectureHref('../c.json', 'org/a/x.json', 'org/b/x.json', 'org/a', 'org/b')
		).toBe('../c.json');
	});

	it('leaves Hub URLs unchanged', () => {
		const href = 'http://localhost:8080/calm/namespaces/onebank/architectures/coa/versions/1.0.0';
		expect(
			rewriteDetailedArchitectureHref(href, 'org/a/x.json', 'org/b/x.json', 'org/a', 'org/b')
		).toBe(href);
	});

	it('plans inbound and outbound rewrites for a folder move', () => {
		const plans = planFolderMoveRewrites(
			[
				{
					oldPath: 'org/outside.json',
					json: {
						nodes: [
							{
								'unique-id': 'ref',
								details: { 'detailed-architecture': 'a/x.json' },
							},
						],
					},
				},
				{
					oldPath: 'org/a/x.json',
					json: {
						nodes: [
							{
								'unique-id': 'out',
								details: { 'detailed-architecture': '../outside.json' },
							},
							{
								'unique-id': 'hub',
								details: {
									'detailed-architecture':
										'http://localhost:8080/calm/namespaces/onebank/architectures/coa/versions/1.0.0',
								},
							},
						],
					},
				},
			],
			'org/a',
			'org/b'
		);
		const outside = plans.find((p) => p.oldPath === 'org/outside.json');
		const moved = plans.find((p) => p.oldPath === 'org/a/x.json');
		expect(outside?.changed).toBe(true);
		expect(
			(outside?.json as { nodes: Array<{ details: { 'detailed-architecture': string } }> }).nodes[0]
				.details['detailed-architecture']
		).toBe('b/x.json');
		expect(moved?.newPath).toBe('org/b/x.json');
		expect(
			(moved?.json as { nodes: Array<{ details: { 'detailed-architecture': string } }> }).nodes[1]
				.details['detailed-architecture']
		).toContain('http://localhost:8080');
	});

	it('retargets an open document path and inbound relative links', () => {
		const result = retargetOpenDocumentAfterMove(
			'org/c.json',
			{
				nodes: [
					{
						'unique-id': 'ref',
						details: { 'detailed-architecture': 'a/x.json' },
					},
				],
			},
			{ 'org/a/x.json': 'org/b/x.json' },
			'org/a',
			'org/b'
		);
		expect(result.relativePath).toBe('org/c.json');
		expect(
			(result.json as { nodes: Array<{ details: { 'detailed-architecture': string } }> }).nodes[0]
				.details['detailed-architecture']
		).toBe('b/x.json');
	});
});
