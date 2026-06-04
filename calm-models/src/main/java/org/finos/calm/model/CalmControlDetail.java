package org.finos.calm.model;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.finos.calm.model.canonical.CalmControlDetailSchema;

import java.util.Optional;

public final class CalmControlDetail {
    private final String requirementUrl;
    private final Optional<String> configUrl;
    private final JsonNode configRaw;
    private final ObjectMapper mapper;

    CalmControlDetail(String requirementUrl, Optional<String> configUrl,
                      JsonNode configRaw, ObjectMapper mapper) {
        this.requirementUrl = requirementUrl;
        this.configUrl = configUrl;
        this.configRaw = configRaw;
        this.mapper = mapper;
    }

    static CalmControlDetail from(CalmControlDetailSchema schema, ObjectMapper mapper) {
        return new CalmControlDetail(
            schema.getRequirementUrl(),
            Optional.ofNullable(schema.getConfigUrl()),
            schema.getConfigRaw(),
            mapper
        );
    }

    public String requirementUrl() { return requirementUrl; }
    public Optional<String> configUrl() { return configUrl; }

    public <T> Optional<T> parseConfig(Class<T> type) {
        if (configRaw == null || configRaw.isNull()) return Optional.empty();
        try {
            return Optional.of(mapper.treeToValue(configRaw, type));
        } catch (JsonProcessingException e) {
            throw new CalmExtensionParseException(
                "Failed to parse control config as " + type.getSimpleName(), e);
        }
    }
}
