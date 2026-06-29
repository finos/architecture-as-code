package org.finos.calm.model;

import org.finos.calm.model.canonical.CalmComposedOfSchema;

import java.util.List;

public record CalmComposedOfType(String container, List<String> nodes) implements CalmRelationshipType {
    static CalmComposedOfType from(CalmComposedOfSchema schema) {
        return new CalmComposedOfType(
            schema.getContainer(),
            schema.getNodes() == null ? List.of() : List.copyOf(schema.getNodes())
        );
    }
}
