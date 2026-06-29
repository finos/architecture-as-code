package org.finos.calm.model;

import org.finos.calm.model.canonical.CalmConnectsSchema;

public record CalmConnectsType(
    CalmNodeInterface source,
    CalmNodeInterface destination
) implements CalmRelationshipType {
    static CalmConnectsType from(CalmConnectsSchema schema) {
        return new CalmConnectsType(
            CalmNodeInterface.from(schema.getSource()),
            CalmNodeInterface.from(schema.getDestination())
        );
    }
}
