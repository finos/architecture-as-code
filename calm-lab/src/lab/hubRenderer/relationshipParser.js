// Ported from calm-hub-ui/src/visualizer/components/reactflow/utils/relationshipParser.ts (commit 705f4a14).
// Keep logic in sync until the shared renderer package extraction.

import { createEdge } from './edgeFactory';
import { extractId } from './calmHelpers';
import { THEME } from './theme';

/**
 * Extracts flow transitions from CALM flows data
 */
export function extractFlowTransitions(flows) {
    const flowTransitions = new Map();

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
            flowTransitions.get(relId).push({ sequence, direction, description, flowName });
        });
    });

    return flowTransitions;
}

/**
 * Parses an interacts relationship into edges
 */
function parseInteractsRelationship(rel, index) {
    const edges = [];
    const interacts = rel['relationship-type']?.interacts;
    if (!interacts) return edges;

    const actorId = interacts.actor;
    const targetNodeIds = interacts.nodes || [];
    const label = rel.description || 'interacts';

    targetNodeIds.forEach((targetId, targetIndex) => {
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
                    ...rel,
                },
            })
        );
    });

    return edges;
}

/**
 * Parses a connects relationship into edges
 */
function parseConnectsRelationship(rel, index, flowTransitions) {
    const edges = [];
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
                    ...rel,
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
                    ...rel,
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
                    ...rel,
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
function isContainmentRelationship(rel) {
    return !!(rel['relationship-type']?.['deployed-in'] || rel['relationship-type']?.['composed-of']);
}

/**
 * Parses all relationships into edges
 */
export function parseRelationships(relationships, flowTransitions) {
    const edges = [];

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
