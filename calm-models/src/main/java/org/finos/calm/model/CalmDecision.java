package org.finos.calm.model;

import org.finos.calm.model.canonical.CalmDecisionSchema;

import java.util.List;
import java.util.Optional;

public record CalmDecision(
    String description,
    List<String> nodes,
    List<String> relationships,
    Optional<List<String>> controls,
    Optional<List<String>> metadata
) {
    static CalmDecision from(CalmDecisionSchema schema) {
        return new CalmDecision(
            schema.getDescription(),
            schema.getNodes() == null ? List.of() : List.copyOf(schema.getNodes()),
            schema.getRelationships() == null ? List.of() : List.copyOf(schema.getRelationships()),
            Optional.ofNullable(schema.getControls()),
            Optional.ofNullable(schema.getMetadata())
        );
    }
}
