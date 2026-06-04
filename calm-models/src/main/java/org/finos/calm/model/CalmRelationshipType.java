package org.finos.calm.model;

import org.finos.calm.model.canonical.CalmRelationshipTypeSchema;

public sealed interface CalmRelationshipType
    permits CalmConnectsType, CalmInteractsType,
            CalmDeployedInType, CalmComposedOfType, CalmOptionsType {

    static CalmRelationshipType from(CalmRelationshipTypeSchema schema) {
        if (schema.getConnects() != null) return CalmConnectsType.from(schema.getConnects());
        if (schema.getInteracts() != null) return CalmInteractsType.from(schema.getInteracts());
        if (schema.getDeployedIn() != null) return CalmDeployedInType.from(schema.getDeployedIn());
        if (schema.getComposedOf() != null) return CalmComposedOfType.from(schema.getComposedOf());
        if (schema.getOptions() != null) return CalmOptionsType.from(schema.getOptions());
        throw new IllegalArgumentException("No recognised relationship type in schema");
    }
}
