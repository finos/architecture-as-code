package org.finos.calm.model;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.finos.calm.model.canonical.CalmDecoratorSchema;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public record CalmDecorator(
    Optional<String> schema,
    String uniqueId,
    String type,
    List<String> targetType,
    List<String> target,
    List<String> appliesTo,
    Map<String, Object> data
) {
    public CalmDecorator {
        targetType = targetType == null ? List.of() : List.copyOf(targetType);
        target = target == null ? List.of() : List.copyOf(target);
        appliesTo = appliesTo == null ? List.of() : List.copyOf(appliesTo);
        // Not Map.copyOf: decorator data is free-form JSON, so a value can be null.
        data = data == null ? Map.of() : Collections.unmodifiableMap(new LinkedHashMap<>(data));
    }

    public static CalmDecorator parse(String json) {
        return parse(json, new ObjectMapper());
    }

    public static CalmDecorator parse(String json, ObjectMapper mapper) {
        try {
            return from(mapper.readValue(json, CalmDecoratorSchema.class), mapper);
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse CALM decorator JSON", e);
        }
    }

    public static CalmDecorator parse(Object object) {
        return parse(object, new ObjectMapper());
    }

    public static CalmDecorator parse(Object object, ObjectMapper mapper) {
        try {
            return from(mapper.convertValue(object, CalmDecoratorSchema.class), mapper);
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse CALM decorator from object", e);
        }
    }

    static CalmDecorator from(CalmDecoratorSchema schema, ObjectMapper mapper) {
        Map<String, Object> data = schema.getData() == null ? Map.of() :
            mapper.convertValue(schema.getData(), new TypeReference<>() {});
        return new CalmDecorator(
            Optional.ofNullable(schema.getSchema()),
            schema.getUniqueId(),
            schema.getType(),
            schema.getTargetType(),
            schema.getTarget(),
            schema.getAppliesTo(),
            data
        );
    }
}
