import { Edge, MarkerType } from 'reactflow';

/**
 * Configuration for creating a ReactFlow edge
 */
export interface EdgeConfig {
    id: string;
    source: string;
    target: string;
    label: string;
    color: string;
    animated?: boolean;
    dashed?: boolean;
    markerPosition?: 'end' | 'start';
    data: Record<string, unknown>;
}

/**
 * Creates a ReactFlow edge with consistent styling
 */
export function createEdge(config: EdgeConfig): Edge {
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

    const edge: Edge = {
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
            id,
            source,
            target,
            label,
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
        } as typeof edge.markerStart;
    }

    return edge;
}
