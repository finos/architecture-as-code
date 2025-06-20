import { Architecture } from '../../model/core';
import { CalmFlowTransition } from '../../model/flow';
import { CalmRelationship, CalmInteractsType, CalmConnectsType, CalmComposedOfType } from '../../model/relationship';

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

        if (relationship.relationshipType instanceof CalmInteractsType) {
            const nodeId = relationship.relationshipType.actor;
            return this.getNodeNameById(nodeId, architecture) || nodeId;
        } else if (relationship.relationshipType instanceof CalmConnectsType) {
            const nodeId = relationship.relationshipType.source.node;
            return this.getNodeNameById(nodeId, architecture) || nodeId;
        } else if (relationship.relationshipType instanceof CalmComposedOfType) {
            const nodeId = relationship.relationshipType.container;
            return this.getNodeNameById(nodeId, architecture) || nodeId;
        } else {
            return FlowSequenceHelper.UNKNOWN_NODE;
        }
    }

    public getTargetFromRelationship(relationshipId: string, architecture: Architecture): string {
        const relationship = this.findRelationshipById(relationshipId, architecture);

        if (relationship.relationshipType instanceof CalmInteractsType) {
            const nodeId = relationship.relationshipType.nodes[0] || '';
            return this.getNodeNameById(nodeId, architecture) || nodeId;
        } else if (relationship.relationshipType instanceof CalmConnectsType) {
            const nodeId = relationship.relationshipType.destination.node;
            return this.getNodeNameById(nodeId, architecture) || nodeId;
        } else if (relationship.relationshipType instanceof CalmComposedOfType) {
            const nodeId = relationship.relationshipType.nodes[0] || '';
            return nodeId;
        } else {
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
