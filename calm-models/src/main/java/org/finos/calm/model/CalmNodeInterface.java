package org.finos.calm.model;

import org.finos.calm.model.canonical.CalmNodeInterfaceSchema;

import java.util.List;
import java.util.Optional;

public record CalmNodeInterface(
    String node,
    Optional<List<String>> interfaces
) {
    static CalmNodeInterface from(CalmNodeInterfaceSchema schema) {
        return new CalmNodeInterface(
            schema.getNode(),
            Optional.ofNullable(schema.getInterfaces())
        );
    }
}
