package org.finos.calm.model;

import org.finos.calm.model.canonical.CalmDeployedInSchema;

import java.util.List;

public record CalmDeployedInType(String container, List<String> nodes) implements CalmRelationshipType {
    static CalmDeployedInType from(CalmDeployedInSchema schema) {
        return new CalmDeployedInType(
            schema.getContainer(),
            schema.getNodes() == null ? List.of() : List.copyOf(schema.getNodes())
        );
    }
}
