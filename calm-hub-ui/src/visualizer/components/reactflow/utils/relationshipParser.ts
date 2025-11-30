import { Edge } from 'reactflow';
import { CalmRelationshipSchema } from '../../../../../../calm-models/src/types/core-types.js';
import { createEdge } from './edgeFactory';
import { extractId } from './calmHelpers';
import { THEME } from '../theme';

/**
 * Flow transition type for tracking bidirectional flows
 */
export interface FlowTransition {
    sequence: number;
    direction: string;
    description: string;
    flowName: string;
}

/**
 * Flow data from CALM architecture
 */
interface CalmFlow {
    name?: string;
    transitions?: Array<{
        'relationship-unique-id': string;
        'sequence-number'?: number;
        direction?: string;
        description?: string;
    }>;
}

/**
 * Extracts flow transitions from CALM flows data
 */
export function extractFlowTransitions(flows: CalmFlow[]): Map<string, FlowTransition[]> {
    const flowTransitions = new Map<string, FlowTransition[]>();

    flows.forEach((flow) => {
        const flowName = flow.name || 'Unnamed Flow';
        const transitions = flow.transitions || [];

        transitions.forEach((transition) => {
            const relId = transition['relationship-unique-id'];
            const direction = transition.direction || 'source-to-destination';
            const sequence = transition['sequence-number'] || 0;
            const description = transition.description || '';

            if (!flowTransitions.has(relId)) {
                flowTransitions.set(relId, []);
            }
            flowTransitions.get(relId)!.push({ sequence, direction, description, flowName });
        });
    });

    return flowTransitions;
}

/**
 * Parses an interacts relationship into edges
 */
function parseInteractsRelationship(
    rel: CalmRelationshipSchema,
    index: number
): Edge[] {
    const edges: Edge[] = [];
    const interacts = rel['relationship-type']?.interacts;
    if (!interacts) return edges;

    const actorId = interacts.actor;
    const targetNodeIds = interacts.nodes || [];
    const label = rel.description || 'interacts';

    targetNodeIds.forEach((targetId: string, targetIndex: number) => {
        edges.push(
            createEdge({
                id: `edge-${index}-${targetIndex}`,
                source: actorId,
                target: targetId,
                label,
                color: THEME.colors.edge.interacts,
                animated: false,
                dashed: true,
                data: {
                    protocol: rel.protocol || '',
                    metadata: rel.metadata || {},
                    'unique-id': extractId(rel),
                    relationshipType: 'interacts',
                },
            })
        );
    });

    return edges;
}

/**
 * Parses a connects relationship into edges
 */
function parseConnectsRelationship(
    rel: CalmRelationshipSchema,
    index: number,
    flowTransitions: Map<string, FlowTransition[]>
): Edge[] {
    const edges: Edge[] = [];
    const connects = rel['relationship-type']?.connects;
    if (!connects) return edges;

    const sourceId = connects.source?.node;
    const targetId = connects.destination?.node;
    const label = rel.description || rel.protocol || '';
    const relId = extractId(rel);

    if (!sourceId || !targetId) return edges;

    const transitions = flowTransitions.get(relId) || [];
    const forwardTransitions = transitions.filter((t) => t.direction === 'source-to-destination');
    const backwardTransitions = transitions.filter((t) => t.direction === 'destination-to-source');

    const commonData = {
        protocol: rel.protocol || '',
        metadata: rel.metadata || {},
        'unique-id': relId,
        controls: rel.controls,
    };

    const hasBidirectionalFlow = forwardTransitions.length > 0 && backwardTransitions.length > 0;

    if (hasBidirectionalFlow) {
        edges.push(
            createEdge({
                id: `edge-${index}-forward`,
                source: sourceId,
                target: targetId,
                label,
                color: THEME.colors.accent,
                data: {
                    ...commonData,
                    flowTransitions: forwardTransitions,
                    direction: 'forward',
                },
            })
        );

        edges.push(
            createEdge({
                id: `edge-${index}-backward`,
                source: sourceId,
                target: targetId,
                label,
                color: THEME.colors.edge.backward,
                dashed: true,
                markerPosition: 'start',
                data: {
                    ...commonData,
                    flowTransitions: backwardTransitions,
                    direction: 'backward',
                },
            })
        );
    } else {
        edges.push(
            createEdge({
                id: `edge-${index}`,
                source: sourceId,
                target: targetId,
                label,
                color: THEME.colors.accent,
                data: {
                    ...commonData,
                    flowTransitions: transitions,
                },
            })
        );
    }

    return edges;
}

/**
 * Checks if a relationship is a containment relationship (deployed-in or composed-of)
 */
function isContainmentRelationship(rel: CalmRelationshipSchema): boolean {
    return !!(rel['relationship-type']?.['deployed-in'] || rel['relationship-type']?.['composed-of']);
}

/**
 * Parses all relationships into edges
 */
export function parseRelationships(
    relationships: CalmRelationshipSchema[],
    flowTransitions: Map<string, FlowTransition[]>
): Edge[] {
    const edges: Edge[] = [];

    relationships.forEach((rel, index) => {
        if (isContainmentRelationship(rel)) {
            return;
        }

        if (rel['relationship-type']?.interacts) {
            edges.push(...parseInteractsRelationship(rel, index));
            return;
        }

        if (rel['relationship-type']?.connects) {
            edges.push(...parseConnectsRelationship(rel, index, flowTransitions));
        }
    });

    return edges;
}
