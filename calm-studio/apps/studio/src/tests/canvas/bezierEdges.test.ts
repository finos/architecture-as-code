// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { orthogonalPathToBezier, pointsToBezierPath } from '$lib/canvas/edgeRouting/bezierPath';
import { getRoutedEdgePath } from '$lib/canvas/edgeRouting/routedEdgePath';

describe('bezier edges', () => {
	it('converts orthogonal waypoints to cubic/quadratic bezier commands', () => {
		const path = pointsToBezierPath([
			{ x: 0, y: 0 },
			{ x: 10, y: 0 },
			{ x: 10, y: 10 },
		]);
		expect(path.startsWith('M 0,0')).toBe(true);
		expect(path.includes('Q') || path.includes('C')).toBe(true);
		expect(path.includes('L ')).toBe(false);
	});

	it('wraps an orthogonal SVG path', () => {
		const bezier = orthogonalPathToBezier('M 0,0 L 20,0 L 20,20');
		expect(bezier).toContain('Q');
	});

	it('returns a bezier path from the obstacle router', () => {
		const [path] = getRoutedEdgePath([], {
			sourceX: 0,
			sourceY: 0,
			targetX: 100,
			targetY: 80,
			sourcePosition: 'right',
			targetPosition: 'left',
		});
		expect(path.startsWith('M ')).toBe(true);
		expect(/[QC]/.test(path)).toBe(true);
	});
});
