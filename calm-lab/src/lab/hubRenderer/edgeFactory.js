// Ported from calm-hub-ui/src/visualizer/components/reactflow/utils/edgeFactory.ts (commit 705f4a14).
// Keep logic in sync until the shared renderer package extraction.

import { MarkerType } from 'reactflow';
import { toDisplayText } from './calmHelpers';

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

    // `...data` is the raw relationship, so `description` and `protocol` come
    // straight from the document — coerce them, the edge label renders both.
    const edgeData = { description: label, ...data };
    edgeData.description = toDisplayText(edgeData.description);
    if ('protocol' in edgeData) {
        edgeData.protocol = toDisplayText(edgeData.protocol);
    }

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
        data: edgeData,
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
