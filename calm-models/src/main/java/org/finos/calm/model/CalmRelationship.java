package org.finos.calm.model;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.finos.calm.model.canonical.CalmMetadataHelper;
import org.finos.calm.model.canonical.CalmRelationshipSchema;

import java.util.Map;
import java.util.Optional;

public final class CalmRelationship {
    private final String uniqueId;
    private final CalmRelationshipType relationshipType;
    private final Optional<String> description;
    private final Optional<CalmProtocol> protocol;
    private final Optional<CalmControls> controls;
    private final Map<String, Object> metadata;
    private final Map<String, JsonNode> extensions;
    private final ObjectMapper mapper;

    CalmRelationship(String uniqueId, CalmRelationshipType relationshipType,
                     Optional<String> description, Optional<CalmProtocol> protocol,
                     Optional<CalmControls> controls, Map<String, Object> metadata,
                     Map<String, JsonNode> extensions, ObjectMapper mapper) {
        this.uniqueId = uniqueId;
        this.relationshipType = relationshipType;
        this.description = description;
        this.protocol = protocol;
        this.controls = controls;
        this.metadata = Map.copyOf(metadata);
        this.extensions = Map.copyOf(extensions);
        this.mapper = mapper;
    }

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
            CalmMetadataHelper.flatten(schema.getMetadataRaw(), mapper),
            schema.getExtensions(),
            mapper
        );
    }

    public String uniqueId() { return uniqueId; }
    public CalmRelationshipType relationshipType() { return relationshipType; }
    public Optional<String> description() { return description; }
    public Optional<CalmProtocol> protocol() { return protocol; }
    public Optional<CalmControls> controls() { return controls; }

    public Optional<Object> getMetadata(String key) {
        return Optional.ofNullable(metadata.get(key));
    }

    public <T> Optional<T> parseMetadata(Class<T> type) {
        if (metadata.isEmpty()) return Optional.empty();
        try {
            return Optional.of(mapper.convertValue(metadata, type));
        } catch (Exception e) {
            throw new CalmExtensionParseException(
                "Failed to parse relationship metadata as " + type.getSimpleName(), e);
        }
    }

    public <T> Optional<T> parseExtension(String name, Class<T> type) {
        JsonNode node = extensions.get(name);
        if (node == null) return Optional.empty();
        try {
            return Optional.of(mapper.treeToValue(node, type));
        } catch (JsonProcessingException e) {
            throw new CalmExtensionParseException(
                "Failed to parse extension '" + name + "' as " + type.getSimpleName(), e);
        }
    }
}
