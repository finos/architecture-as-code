package org.finos.calm.model;

import org.finos.calm.model.canonical.CalmFlowTransitionSchema;

public record CalmFlowTransition(
    String relationshipUniqueId,
    int sequenceNumber,
    String description,
    FlowDirection direction
) {
    static CalmFlowTransition from(CalmFlowTransitionSchema schema) {
        FlowDirection dir = schema.getDirection() != null
            ? schema.getDirection()
            : FlowDirection.SOURCE_TO_DESTINATION;
        return new CalmFlowTransition(
            schema.getRelationshipUniqueId(),
            schema.getSequenceNumber(),
            schema.getDescription(),
            dir
        );
    }
}
