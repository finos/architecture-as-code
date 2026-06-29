package org.finos.calm.model;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.finos.calm.model.canonical.CalmControlSchema;

import java.util.List;

public record CalmControl(
    String description,
    List<CalmControlDetail> requirements
) {
    static CalmControl from(CalmControlSchema schema, ObjectMapper mapper) {
        List<CalmControlDetail> reqs = schema.getRequirements() == null ? List.of() :
            schema.getRequirements().stream()
                .map(r -> CalmControlDetail.from(r, mapper))
                .toList();
        return new CalmControl(schema.getDescription(), reqs);
    }
}
