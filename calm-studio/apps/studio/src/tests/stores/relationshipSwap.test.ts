// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, test } from 'vitest';
import { swapRelationshipDirection } from '$lib/stores/relationshipSwap';

describe('relationshipSwap', () => {
	test('swap connects source and destination', () => {
		const result = swapRelationshipDirection('connects', 'a', 'b');
		expect(result.source).toBe('b');
		expect(result.target).toBe('a');
		expect(result.relationshipType).toEqual({
			connects: {
				source: { node: 'b' },
				destination: { node: 'a' },
			},
		});
	});

	test('swap composed-of swaps container and nodes', () => {
		const result = swapRelationshipDirection('composed-of', 'container', 'child');
		expect(result.relationshipType).toEqual({
			'composed-of': { container: 'child', nodes: ['container'] },
		});
	});

	test('swap interacts swaps actor and nodes', () => {
		const result = swapRelationshipDirection('interacts', 'actor', 'svc');
		expect(result.relationshipType).toEqual({
			interacts: { actor: 'svc', nodes: ['actor'] },
		});
	});
});
