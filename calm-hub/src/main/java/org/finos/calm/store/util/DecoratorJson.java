package org.finos.calm.store.util;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.bson.json.JsonParseException;

import java.util.Map;

/**
 * Parses a decorator body as the write rules saw it, to JDK types only. Extended-JSON keys such as
 * {@code $numberInt} or {@code $maxKey} stay plain data, so a store keeps the value that Hub validated.
 */
public final class DecoratorJson {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private DecoratorJson() {
    }

    public static Map<String, Object> parseObject(String json) {
        Map<String, Object> map;
        try {
            map = MAPPER.readValue(json, new TypeReference<>() { });
        } catch (JsonProcessingException e) {
            throw new JsonParseException(e.getOriginalMessage());
        }
        if (map == null) {
            throw new JsonParseException("Decorator JSON must be an object");
        }
        return map;
    }
}
