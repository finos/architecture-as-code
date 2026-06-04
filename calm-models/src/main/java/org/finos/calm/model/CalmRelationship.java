package org.finos.calm.model;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.finos.calm.model.canonical.CalmMetadataHelper;
import org.finos.calm.model.canonical.CalmRelationshipSchema;

import java.util.Map;
import java.util.Optional;

public record CalmRelationship(
    String uniqueId,
    CalmRelationshipType relationshipType,
    Optional<String> description,
    Optional<CalmProtocol> protocol,
    Optional<CalmControls> controls,
    Map<String, Object> metadata
) {
    static CalmRelationship from(CalmRelationshipSchema schema, ObjectMapper mapper) {
        Optional<CalmControls> controls = schema.getControls() != null
            ? Optional.of(CalmControls.from(schema.getControls(), mapper))
            : Optional.empty();
        return new CalmRelationship(
            schema.getUniqueId(),
            CalmRelationshipType.from(schema.getRelationshipType()),
            Optional.ofNullable(schema.getDescription()),
            Optional.ofNullable(schema.getProtocol()),
            controls,
            CalmMetadataHelper.flatten(schema.getMetadataRaw(), mapper)
        );
    }

    public Optional<Object> getMetadata(String key) {
        return Optional.ofNullable(metadata.get(key));
    }
}
