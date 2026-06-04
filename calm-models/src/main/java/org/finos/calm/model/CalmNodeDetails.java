package org.finos.calm.model;

import org.finos.calm.model.canonical.CalmNodeDetailsSchema;

import java.util.Optional;

public record CalmNodeDetails(
    Optional<String> detailedArchitecture,
    Optional<String> requiredPattern
) {
    static CalmNodeDetails from(CalmNodeDetailsSchema schema) {
        return new CalmNodeDetails(
            Optional.ofNullable(schema.getDetailedArchitecture()),
            Optional.ofNullable(schema.getRequiredPattern())
        );
    }
}
