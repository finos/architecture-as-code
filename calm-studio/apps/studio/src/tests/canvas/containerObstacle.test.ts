// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { relationshipObstacleExclusions } from '$lib/canvas/edgeRouting/obstacleRouter';

describe('relationshipObstacleExclusions', () => {
	const nodes = [
		{ id: 'box', parentId: undefined },
		{ id: 'a', parentId: 'box' },
		{ id: 'b', parentId: 'box' },
		{ id: 'out', parentId: undefined },
	];

	it('does not treat a container as an obstacle when one end is inside it', () => {
		const exclude = relationshipObstacleExclusions(nodes, 'a', 'out');
		expect(exclude.has('box')).toBe(true);
		expect(exclude.has('a')).toBe(true);
		expect(exclude.has('out')).toBe(true);
		expect(exclude.has('b')).toBe(false);
	});

	it('ignores nodes outside the shared container when both ends are inside', () => {
		const exclude = relationshipObstacleExclusions(nodes, 'a', 'b');
		expect(exclude.has('box')).toBe(true);
		expect(exclude.has('out')).toBe(true);
		expect(exclude.has('a')).toBe(true);
		expect(exclude.has('b')).toBe(true);
	});
});
