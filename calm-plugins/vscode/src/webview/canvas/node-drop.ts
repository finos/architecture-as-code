import type { Node, XYPosition } from 'reactflow';
import { getDetailNodeVisual } from './nodes/nodeVisuals';

const CORE_NODE_TYPES = new Set(['actor', 'ecosystem', 'system', 'service', 'database', 'network', 'ldap', 'webclient', 'data-asset']);

export const CALM_NODE_TYPE_MIME = 'application/calm-node-type';
export const CALM_NODE_LABEL_MIME = 'application/calm-node-label';
export const CALM_CONTAINER_MIME = 'application/calm-container';

export interface PaletteDragPayload {
    nodeType: string;
    nodeLabel: string;
    isContainer?: boolean;
}

export interface PaletteDropInput extends PaletteDragPayload {
    position: XYPosition;
    id?: string;
}

export function resolveFlowNodeType(calmType: string): string {
    if (CORE_NODE_TYPES.has(calmType)) return calmType;
    return 'extension';
}

export function buildPaletteDragPayload({ nodeType, nodeLabel, isContainer = false }: PaletteDragPayload): Record<string, string> {
    return {
        [CALM_NODE_TYPE_MIME]: nodeType,
        [CALM_NODE_LABEL_MIME]: nodeLabel,
        [CALM_CONTAINER_MIME]: String(isContainer),
    };
}

export function createPaletteNodeFromDrop({
    nodeType,
    nodeLabel,
    isContainer = false,
    position,
    id = `${nodeType.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}`,
}: PaletteDropInput): Node {
    if (isContainer) {
        return {
            id,
            type: 'container',
            position,
            width: 400,
            height: 300,
            data: {
                label: nodeLabel || 'Container',
                calmId: id,
                calmType: nodeType,
                description: '',
                containerRole: 'default',
                containmentType: 'deployed-in',
            },
        } as Node;
    }

    return {
        id,
        type: resolveFlowNodeType(nodeType),
        position,
        data: {
            label: nodeLabel || nodeType,
            calmId: id,
            calmType: nodeType,
            description: '',
            interfaces: [],
            metadata: {},
        },
        width: getDetailNodeVisual(nodeType).width,
        height: getDetailNodeVisual(nodeType).height,
    };
}