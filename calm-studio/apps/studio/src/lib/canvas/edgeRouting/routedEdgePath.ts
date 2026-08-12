// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * routedEdgePath.ts — shared obstacle-aware edge path helper (R23).
 */

import type { Node, Position } from '@xyflow/svelte';
import {
	collectNodeObstacles,
	routeEdgeOrthogonal,
	type HandlePosition,
} from './obstacleRouter';

export const CANVAS_NODES_CONTEXT = 'calm-canvas-nodes';

export type CanvasNodesGetter = () => Node[];

function toHandlePosition(pos: Position | string | undefined): HandlePosition {
	if (pos === 'top' || pos === 'bottom' || pos === 'left' || pos === 'right') return pos;
	return 'right';
}

/**
 * Compute an obstacle-aware orthogonal path for an edge.
 * Returns [path, labelX, labelY] matching getSmoothStepPath shape.
 */
export function getRoutedEdgePath(
	nodes: Node[],
	args: {
		sourceX: number;
		sourceY: number;
		targetX: number;
		targetY: number;
		sourcePosition?: Position | string;
		targetPosition?: Position | string;
		sourceId?: string;
		targetId?: string;
	}
): [string, number, number] {
	const exclude = new Set<string>();
	if (args.sourceId) exclude.add(args.sourceId);
	if (args.targetId) exclude.add(args.targetId);

	const obstacles = collectNodeObstacles(nodes, exclude, 0);
	const result = routeEdgeOrthogonal({
		source: {
			x: args.sourceX,
			y: args.sourceY,
			position: toHandlePosition(args.sourcePosition),
		},
		target: {
			x: args.targetX,
			y: args.targetY,
			position: toHandlePosition(args.targetPosition),
		},
		obstacles,
		padding: 8,
	});
	return [result.path, result.labelX, result.labelY];
}
