package org.finos.calm.model;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.finos.calm.model.canonical.CalmMetadataHelper;
import org.finos.calm.model.canonical.CalmNodeSchema;

import java.util.List;
import java.util.Map;
import java.util.Optional;

public final class CalmNode {
    private final String uniqueId;
    private final String nodeType;
    private final String name;
    private final String description;
    private final Optional<CalmNodeDetails> details;
    private final List<CalmInterface> interfaces;
    private final Optional<CalmControls> controls;
    private final Map<String, Object> metadata;
    private final Map<String, JsonNode> extensions;
    private final ObjectMapper mapper;

    CalmNode(String uniqueId, String nodeType, String name, String description,
             Optional<CalmNodeDetails> details, List<CalmInterface> interfaces,
             Optional<CalmControls> controls, Map<String, Object> metadata,
             Map<String, JsonNode> extensions, ObjectMapper mapper) {
        this.uniqueId = uniqueId;
        this.nodeType = nodeType;
        this.name = name;
        this.description = description;
        this.details = details;
        this.interfaces = List.copyOf(interfaces);
        this.controls = controls;
        this.metadata = Map.copyOf(metadata);
        this.extensions = Map.copyOf(extensions);
        this.mapper = mapper;
    }

    static CalmNode from(CalmNodeSchema schema, ObjectMapper mapper) {
        Optional<CalmNodeDetails> details = schema.getDetails() != null
            ? Optional.of(CalmNodeDetails.from(schema.getDetails()))
            : Optional.empty();
        List<CalmInterface> interfaces = schema.getInterfaces() == null ? List.of() :
            schema.getInterfaces().stream().map(j -> CalmInterface.from(j, mapper)).toList();
        Optional<CalmControls> controls = schema.getControls() != null
            ? Optional.of(CalmControls.from(schema.getControls(), mapper))
            : Optional.empty();
        return new CalmNode(
            schema.getUniqueId(),
            schema.getNodeType(),
            schema.getName(),
            schema.getDescription(),
            details,
            interfaces,
            controls,
            CalmMetadataHelper.flatten(schema.getMetadataRaw(), mapper),
            schema.getExtensions(),
            mapper
        );
    }

    public String uniqueId() { return uniqueId; }
    public String nodeType() { return nodeType; }
    public String name() { return name; }
    public String description() { return description; }
    public Optional<CalmNodeDetails> details() { return details; }
    public List<CalmInterface> interfaces() { return interfaces; }
    public Optional<CalmControls> controls() { return controls; }

    public Optional<CalmInterface> findInterface(String uniqueId) {
        return interfaces.stream().filter(i -> i.uniqueId().equals(uniqueId)).findFirst();
    }

    public Optional<CalmControl> findControl(String controlId) {
        return controls.flatMap(c -> c.findControl(controlId));
    }

    public Optional<Object> getMetadata(String key) {
        return Optional.ofNullable(metadata.get(key));
    }

    public <T> Optional<T> parseMetadata(Class<T> type) {
        if (metadata.isEmpty()) return Optional.empty();
        try {
            return Optional.of(mapper.convertValue(metadata, type));
        } catch (Exception e) {
            throw new CalmExtensionParseException(
                "Failed to parse node metadata as " + type.getSimpleName(), e);
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
