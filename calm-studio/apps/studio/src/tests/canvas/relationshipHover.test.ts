// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import type { Node } from '@xyflow/svelte';
import {
	applyRelationshipHoverClass,
	RELATIONSHIP_HOVER_CLASS,
} from '$lib/canvas/relationshipHover';

function node(id: string, cls?: string): Node {
	return { id, position: { x: 0, y: 0 }, data: {}, class: cls };
}

describe('applyRelationshipHoverClass', () => {
	it('marks only the two endpoints and keeps other classes', () => {
		const nodes = [node('a', 'reference-node'), node('b'), node('c')];
		const next = applyRelationshipHoverClass(nodes, 'a', 'b');
		expect(next[0].class).toBe(`reference-node ${RELATIONSHIP_HOVER_CLASS}`);
		expect(next[1].class).toBe(RELATIONSHIP_HOVER_CLASS);
		expect(next[2].class).toBeUndefined();
	});

	it('clears the highlight and returns the same array when nothing changes', () => {
		const nodes = [node('a'), node('b')];
		const lit = applyRelationshipHoverClass(nodes, 'a', 'b');
		const cleared = applyRelationshipHoverClass(lit, null, null);
		expect(cleared[0].class).toBeUndefined();
		expect(applyRelationshipHoverClass(cleared, null, null)).toBe(cleared);
	});
});
