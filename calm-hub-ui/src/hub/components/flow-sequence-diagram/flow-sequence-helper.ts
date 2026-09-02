import {
    Architecture,
    CalmFlowTransition,
    CalmRelationship,
    CalmInteractsType,
    CalmConnectsType,
    CalmComposedOfType,
    CalmDeployedInType
} from '@finos/calm-models/model';

/**
 * Resolves flow-transition participants (source/target node names and ids) from the
 * typed CALM model, rather than parsing relationship-id strings.
 *
 * TODO(#2690): near-duplicate of `shared/src/docify/graphing/flow-sequence-helper.ts`.
 * `@finos/calm-shared` only exposes a barrel that pulls Node-only modules into the
 * browser bundle, so it cannot be imported here until that package gains a
 * browser-safe entry point (#1998, #2537).
 */
export class FlowSequenceHelper {
    public static readonly UNKNOWN_NODE = 'unknown';

    public transformFlowTransitions(transitions: CalmFlowTransition[], architecture: Architecture) {
        return transitions.map((transition: CalmFlowTransition) => ({
            ...transition,
            relationshipId: transition.relationshipUniqueId,
            source: this.getSourceFromRelationship(transition.relationshipUniqueId, architecture),
            target: this.getTargetFromRelationship(transition.relationshipUniqueId, architecture)
        }));
    }

    public getSourceFromRelationship(relationshipId: string, architecture: Architecture): string {
        const relationship = this.findRelationshipById(relationshipId, architecture);
        if (!relationship) return FlowSequenceHelper.UNKNOWN_NODE;

        const type = relationship.relationshipType;

        switch (type.kind) {
        case 'interacts': {
            const typed = type as CalmInteractsType;
            return this.resolveNodeName(typed.actor, architecture);
        }
        case 'connects': {
            const typed = type as CalmConnectsType;
            return this.resolveNodeName(typed.source.node, architecture);
        }
        case 'composed-of': {
            const typed = type as CalmComposedOfType;
            return this.resolveNodeName(typed.container, architecture);
        }
        case 'deployed-in': {
            const typed = type as CalmDeployedInType;
            return this.resolveNodeName(typed.container, architecture);
        }
        default:
            return FlowSequenceHelper.UNKNOWN_NODE;
        }
    }

    public getTargetFromRelationship(relationshipId: string, architecture: Architecture): string {
        const relationship = this.findRelationshipById(relationshipId, architecture);
        if (!relationship) return FlowSequenceHelper.UNKNOWN_NODE;

        const type = relationship.relationshipType;

        switch (type.kind) {
        case 'interacts': {
            const typed = type as CalmInteractsType;
            return this.resolveNodeName(typed.nodes[0] || '', architecture);
        }
        case 'connects': {
            const typed = type as CalmConnectsType;
            return this.resolveNodeName(typed.destination.node, architecture);
        }
        case 'composed-of': {
            const typed = type as CalmComposedOfType;
            return this.resolveNodeName(typed.nodes[0] || '', architecture);
        }
        case 'deployed-in': {
            const typed = type as CalmDeployedInType;
            return this.resolveNodeName(typed.nodes[0] || '', architecture);
        }
        default:
            return FlowSequenceHelper.UNKNOWN_NODE;
        }
    }

    public findRelationshipById(relationshipId: string, architecture: Architecture): CalmRelationship | undefined {
        return architecture?.relationships.find(rel => rel.uniqueId === relationshipId);
    }

    public getNodeNameById(nodeId: string, architecture: Architecture): string | undefined {
        const node = architecture?.nodes.find(node => node.uniqueId === nodeId);
        return node?.name;
    }

    /** Resolves a node id to its display name, falling back to the id when unknown or empty. */
    private resolveNodeName(nodeId: string, architecture: Architecture): string {
        if (!nodeId) return FlowSequenceHelper.UNKNOWN_NODE;
        return this.getNodeNameById(nodeId, architecture) || nodeId;
    }

    /** Returns all node unique-ids that participate in a relationship (for graph highlighting). */
    public getNodeIdsFromRelationship(relationshipId: string, architecture: Architecture): string[] {
        const relationship = this.findRelationshipById(relationshipId, architecture);
        if (!relationship) return [];

        const type = relationship.relationshipType;

        switch (type.kind) {
        case 'interacts': {
            const typed = type as CalmInteractsType;
            return [typed.actor, ...typed.nodes];
        }
        case 'connects': {
            const typed = type as CalmConnectsType;
            return [typed.source.node, typed.destination.node];
        }
        case 'composed-of': {
            const typed = type as CalmComposedOfType;
            return [typed.container, ...typed.nodes];
        }
        case 'deployed-in': {
            const typed = type as CalmDeployedInType;
            return [typed.container, ...typed.nodes];
        }
        default:
            return [];
        }
    }
}

/**
 * Return-direction transitions are drawn with source and target swapped, so
 * callers do not repeat the swap. Returns [displaySource, displayTarget].
 */
export function orientEndpoints<T>(source: T, target: T, isReturn: boolean): [T, T] {
    return isReturn ? [target, source] : [source, target];
}

