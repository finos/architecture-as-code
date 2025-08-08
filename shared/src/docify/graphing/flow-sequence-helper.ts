import { Architecture } from '../../model/core';
import { CalmFlowTransition } from '../../model/flow';
import {
    CalmRelationship,
    CalmInteractsType,
    CalmConnectsType,
    CalmComposedOfType
} from '../../model/relationship';

export class FlowSequenceHelper {
    public static readonly UNKNOWN_NODE = 'unknown';

    /**
     * Transforms flow transitions by adding source and target information
     * @param transitions The flow transitions to transform
     * @param architecture The architecture containing nodes and relationships
     * @returns Transformed transitions with source and target information
     */
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
            return this.getNodeNameById(typed.actor, architecture) || typed.actor;
        }
        case 'connects': {
            const typed = type as CalmConnectsType;
            return this.getNodeNameById(typed.source.node, architecture) || typed.source.node;
        }
        case 'composed-of': {
            const typed = type as CalmComposedOfType;
            return this.getNodeNameById(typed.container, architecture) || typed.container;
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
            const nodeId = typed.nodes[0] || '';
            return this.getNodeNameById(nodeId, architecture) || nodeId;
        }
        case 'connects': {
            const typed = type as CalmConnectsType;
            return this.getNodeNameById(typed.destination.node, architecture) || typed.destination.node;
        }
        case 'composed-of': {
            const typed = type as CalmComposedOfType;
            return typed.nodes[0] || '';
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
}
