// Ported from calm-hub-ui/src/visualizer/components/reactflow/utils/edgeFactory.ts (commit 705f4a14).
// Keep logic in sync until the shared renderer package extraction.

import { MarkerType } from 'reactflow';

/**
 * Creates a ReactFlow edge with consistent styling
 */
export function createEdge(config) {
    const {
        id,
        source,
        target,
        label,
        color,
        animated = true,
        dashed = false,
        markerPosition = 'end',
        data,
    } = config;

    const edge = {
        id,
        source,
        target,
        sourceHandle: 'source',
        targetHandle: 'target',
        type: 'custom',
        animated,
        style: {
            stroke: color,
            strokeWidth: dashed ? 2 : 2.5,
            ...(dashed && { strokeDasharray: '5,5' }),
        },
        data: {
            description: label,
            ...data,
        },
    };

    if (markerPosition === 'end') {
        edge.markerEnd = {
            type: MarkerType.ArrowClosed,
            color,
            width: 25,
            height: 25,
        };
    } else {
        edge.markerStart = {
            type: MarkerType.ArrowClosed,
            color,
            width: 25,
            height: 25,
            // ReactFlow types don't include 'orient' but it's valid SVG
            orient: 'auto-start-reverse',
        };
    }

    return edge;
}
