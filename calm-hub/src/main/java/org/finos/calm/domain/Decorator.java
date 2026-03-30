package org.finos.calm.domain;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Represents a decorator in the CALM system.
 * A decorator contains metadata and properties that can be applied to architectures or other elements.
 *
 * <p>Immutable</p>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class Decorator {
    private final String schema;
    private final String uniqueId;
    private final String type;
    private final List<String> target;
    private final List<String> targetType;
    private final List<String> appliesTo;
    private final Object data;

    private Decorator(DecoratorBuilder builder) {
        this.schema = builder.schema;
        this.uniqueId = builder.uniqueId;
        this.type = builder.type;
        this.target = builder.target;
        this.targetType = builder.targetType;
        this.appliesTo = builder.appliesTo;
        this.data = builder.data;
    }

    public String getSchema() {
        return schema;
    }

    @JsonProperty("unique-id")
    public String getUniqueId() {
        return uniqueId;
    }

    public String getType() {
        return type;
    }

    public List<String> getTarget() {
        return target;
    }

    @JsonProperty("target-type")
    public List<String> getTargetType() {
        return targetType;
    }

    @JsonProperty("applies-to")
    public List<String> getAppliesTo() {
        return appliesTo;
    }

    public Object getData() {
        return data;
    }

    @Override
    public boolean equals(Object o) {
        if (o == null || getClass() != o.getClass()) return false;
        Decorator that = (Decorator) o;
        return Objects.equals(schema, that.schema)
                && Objects.equals(uniqueId, that.uniqueId)
                && Objects.equals(type, that.type)
                && Objects.equals(target, that.target)
                && Objects.equals(targetType, that.targetType)
                && Objects.equals(appliesTo, that.appliesTo)
                && Objects.equals(data, that.data);
    }

    @Override
    public int hashCode() {
        return Objects.hash(schema, uniqueId, type, target, targetType, appliesTo, data);
    }

    @Override
    public String toString() {
        return "Decorator{" +
                "schema='" + schema + '\'' +
                ", uniqueId='" + uniqueId + '\'' +
                ", type='" + type + '\'' +
                ", target=" + target +
                ", targetType=" + targetType +
                ", appliesTo=" + appliesTo +
                ", data=" + data +
                '}';
    }

    @SuppressWarnings("unchecked")
    public static Decorator fromDocument(Map<String, Object> document) {
        if (document == null) {
            return null;
        }
        return new DecoratorBuilder()
                .setSchema((String) document.get("$schema"))
                .setUniqueId((String) document.get("unique-id"))
                .setType((String) document.get("type"))
                .setTarget((List<String>) document.get("target"))
                .setTargetType((List<String>) document.get("target-type"))
                .setAppliesTo((List<String>) document.get("applies-to"))
                .setData(document.get("data"))
                .build();
    }

    public static class DecoratorBuilder {
        private String schema;
        private String uniqueId;
        private String type;
        private List<String> target;
        private List<String> targetType;
        private List<String> appliesTo;
        private Object data;

        public DecoratorBuilder setSchema(String schema) {
            this.schema = schema;
            return this;
        }

        public DecoratorBuilder setUniqueId(String uniqueId) {
            this.uniqueId = uniqueId;
            return this;
        }

        public DecoratorBuilder setType(String type) {
            this.type = type;
            return this;
        }

        public DecoratorBuilder setTarget(List<String> target) {
            this.target = target;
            return this;
        }

        public DecoratorBuilder setTargetType(List<String> targetType) {
            this.targetType = targetType;
            return this;
        }

        public DecoratorBuilder setAppliesTo(List<String> appliesTo) {
            this.appliesTo = appliesTo;
            return this;
        }

        public DecoratorBuilder setData(Object data) {
            this.data = data;
            return this;
        }

        public Decorator build() {
            return new Decorator(this);
        }
    }
}
