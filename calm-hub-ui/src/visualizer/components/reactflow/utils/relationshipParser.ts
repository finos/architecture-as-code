import { Edge } from 'reactflow';
import { CalmRelationshipSchema } from '@finos/calm-models/types';
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
    const label = rel.description || '';

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

/**
 * Connects edges to the drawings of nodes that are in several containers. Copies connect to the
 * copies that share the most containers with them, e.g. two services in the same cluster. A drawing
 * with no such partner connects to its best matches, so a node drawn once connects to every copy.
 * When one end contains drawings of the other, only those drawings connect. When no copies of the
 * two ends share a container, one edge connects their first drawings.
 */
export function expandEdgesToInstances(
    edges: Edge[],
    instancesOf: Map<string, string[]>,
    ancestorsOf: Map<string, string[]>
): Edge[] {
    const sharedContainers = (a: string, b: string) => {
        const ofB = new Set(ancestorsOf.get(b) ?? []);
        return (ancestorsOf.get(a) ?? []).filter((x) => ofB.has(x)).length;
    };
    const contains = (outer: string, inner: string) => (ancestorsOf.get(inner) ?? []).includes(outer);

    return edges.flatMap((edge) => {
        const sources = instancesOf.get(edge.source) ?? [edge.source];
        const targets = instancesOf.get(edge.target) ?? [edge.target];
        if (sources.length === 1 && targets.length === 1) return [edge];

        const pairs = sources.flatMap((source) =>
            targets.map((target) => ({ source, target, score: sharedContainers(source, target) }))
        );
        const nested = pairs.filter((p) => contains(p.source, p.target) || contains(p.target, p.source));
        const bestForSource = new Map<string, number>();
        const bestForTarget = new Map<string, number>();
        for (const p of pairs) {
            bestForSource.set(p.source, Math.max(bestForSource.get(p.source) ?? 0, p.score));
            bestForTarget.set(p.target, Math.max(bestForTarget.get(p.target) ?? 0, p.score));
        }
        const isBest = (p: (typeof pairs)[number]) =>
            p.score === bestForSource.get(p.source) && p.score === bestForTarget.get(p.target);
        const linked = new Set(pairs.filter(isBest).flatMap((p) => [p.source, p.target]));
        const kept = nested.length > 0
            ? nested
            : sources.length > 1 && targets.length > 1 && pairs.every((p) => p.score === 0)
                ? pairs.slice(0, 1)
                : pairs.filter((p) => isBest(p)
                    || (!linked.has(p.source) && p.score === bestForSource.get(p.source))
                    || (!linked.has(p.target) && p.score === bestForTarget.get(p.target)));
        return kept.map((p, i) => ({ ...edge, id: i === 0 ? edge.id : `${edge.id}__${i}`, source: p.source, target: p.target }));
    });
}
