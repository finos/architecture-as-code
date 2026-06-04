package org.finos.calm.model;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

public final class CalmInterface {
    private final String uniqueId;
    private final JsonNode rawJson;
    private final ObjectMapper mapper;

    CalmInterface(String uniqueId, JsonNode rawJson, ObjectMapper mapper) {
        this.uniqueId = uniqueId;
        this.rawJson = rawJson;
        this.mapper = mapper;
    }

    static CalmInterface from(JsonNode json, ObjectMapper mapper) {
        return new CalmInterface(json.path("unique-id").asText(), json, mapper);
    }

    public String uniqueId() { return uniqueId; }

    public <T> T parseAs(Class<T> type) {
        try {
            ObjectNode stripped = ((ObjectNode) rawJson.deepCopy()).without("unique-id");
            return mapper.treeToValue(stripped, type);
        } catch (JsonProcessingException e) {
            throw new CalmExtensionParseException(
                "Failed to parse interface as " + type.getSimpleName(), e);
        }
    }
}
