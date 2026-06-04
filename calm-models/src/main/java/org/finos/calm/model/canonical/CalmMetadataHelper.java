package org.finos.calm.model.canonical;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.LinkedHashMap;
import java.util.Map;

class CalmMetadataHelper {
    static Map<String, Object> flatten(JsonNode raw, ObjectMapper mapper) {
        if (raw == null || raw.isNull() || raw.isMissingNode()) return Map.of();
        if (raw.isArray()) {
            Map<String, Object> result = new LinkedHashMap<>();
            raw.forEach(item -> item.fields().forEachRemaining(e ->
                result.put(e.getKey(), mapper.convertValue(e.getValue(), Object.class))));
            return Map.copyOf(result);
        }
        return mapper.convertValue(raw, new TypeReference<>() {});
    }
}
