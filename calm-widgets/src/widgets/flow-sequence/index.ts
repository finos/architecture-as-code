import { CalmWidget } from '../../types';
import { isObjectLike } from 'lodash';
import {
    CalmCoreCanonicalModel,
    CalmRelationshipCanonicalModel,
    CalmFlowCanonicalModel,
    CalmFlowTransitionCanonicalModel,
    CalmRelationshipTypeCanonicalModel,
    visitRelationship
} from '@finos/calm-models/canonical';

interface FlowSequenceOptions {
    ['flow-id']: string;
}

interface TransformedTransition {
    relationshipId: string;
    source: string;
    target: string;
    description: string;
    direction?: string;
}

interface FlowSequenceViewModel {
    transitions: TransformedTransition[];
}

function hasFlows(x: unknown): x is { flows: CalmFlowCanonicalModel[] } {
    return (
        isObjectLike(x) &&
        'flows' in (x as object) &&
        Array.isArray((x as { flows?: unknown }).flows)
    );
}

export const FlowSequenceWidget: CalmWidget<
    CalmCoreCanonicalModel,
    FlowSequenceOptions,
    FlowSequenceViewModel
> = {
    id: 'flow-sequence',
    templatePartial: 'flow-sequence-template.hbs',

    transformToViewModel: (architecture, options) => {
        const flowId = options?.['flow-id'];
        if (!flowId) throw new Error('flow-id option is required');

        const flows = architecture.flows;
        if (!Array.isArray(flows)) {
            throw new Error('architecture.flows is missing or not an array');
        }
        const flow = flows.find((f: CalmFlowCanonicalModel) => f['unique-id'] === flowId);
        if (!flow) throw new Error(`Flow with unique-id '${flowId}' not found in architecture.flows`);

        const transitions = flow.transitions.map((transition: CalmFlowTransitionCanonicalModel) => ({
            relationshipId: transition['relationship-unique-id'],
            source: getSourceFromRelationship(transition['relationship-unique-id'], architecture),
            target: getTargetFromRelationship(transition['relationship-unique-id'], architecture),
            description: transition.description || '',
            direction: transition.direction ?? 'source-to-destination'
        }));

        return { transitions };
    },

    validateContext: (context: unknown, options?: FlowSequenceOptions): context is CalmCoreCanonicalModel => {
        if (!hasFlows(context)) return false;
        const flowId = options?.['flow-id'];
        if (!flowId) return false;
        return (context as { flows: CalmFlowCanonicalModel[] }).flows.some(
            (f: CalmFlowCanonicalModel) => f['unique-id'] === flowId
        );
    }
};

function getSourceFromRelationship(relationshipId: string, architecture: CalmCoreCanonicalModel): string {
    const relationship = findRelationshipById(relationshipId, architecture);
    if (!relationship) return 'unknown';
    const relType = relationship['relationship-type'] as CalmRelationshipTypeCanonicalModel | undefined;
    if (!relType) return 'unknown';

    return visitRelationship(relType, {
        interacts: r => getNodeNameById(r.interacts.actor, architecture) ?? r.interacts.actor,
        connects: r => getNodeNameById(r.connects.source.node, architecture) ?? r.connects.source.node,
        composedOf: r => getNodeNameById(r['composed-of'].container, architecture) ?? r['composed-of'].container,
        deployedIn: r => getNodeNameById(r['deployed-in'].container, architecture) ?? r['deployed-in'].container,
        default: () => 'unknown'
    });
}

function getTargetFromRelationship(relationshipId: string, architecture: CalmCoreCanonicalModel): string {
    const relationship = findRelationshipById(relationshipId, architecture);
    if (!relationship) return 'unknown';
    const relType = relationship['relationship-type'] as CalmRelationshipTypeCanonicalModel | undefined;
    if (!relType) return 'unknown';

    return visitRelationship(relType, {
        interacts: r => {
            const nodeId = r.interacts.nodes?.[0] ?? '';
            return getNodeNameById(nodeId, architecture) ?? nodeId;
        },
        connects: r => getNodeNameById(r.connects.destination.node, architecture) ?? r.connects.destination.node,
        composedOf: r => {
            const nodeId = r['composed-of'].nodes?.[0] ?? '';
            return getNodeNameById(nodeId, architecture) ?? nodeId;
        },
        deployedIn: r => {
            const nodeId = r['deployed-in'].nodes?.[0] ?? '';
            return getNodeNameById(nodeId, architecture) ?? nodeId;
        },
        default: () => 'unknown'
    });
}

function findRelationshipById(
    relationshipId: string,
    architecture: CalmCoreCanonicalModel
): CalmRelationshipCanonicalModel | undefined {
    return architecture.relationships.find(rel => rel['unique-id'] === relationshipId);
}

function getNodeNameById(nodeId: string, architecture: CalmCoreCanonicalModel): string | undefined {
    const node = architecture.nodes.find(n => n['unique-id'] === nodeId);
    return node?.name;
}
