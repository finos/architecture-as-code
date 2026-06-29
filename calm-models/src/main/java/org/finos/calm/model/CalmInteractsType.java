package org.finos.calm.model;

import org.finos.calm.model.canonical.CalmInteractsSchema;

import java.util.List;

public record CalmInteractsType(String actor, List<String> nodes) implements CalmRelationshipType {
    static CalmInteractsType from(CalmInteractsSchema schema) {
        return new CalmInteractsType(
            schema.getActor(),
            schema.getNodes() == null ? List.of() : List.copyOf(schema.getNodes())
        );
    }
}
