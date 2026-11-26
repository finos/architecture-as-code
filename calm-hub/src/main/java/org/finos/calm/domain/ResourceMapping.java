package org.finos.calm.domain;

import io.quarkus.runtime.annotations.RegisterForReflection;

import java.util.Objects;

/**
 * Represents a mapping between a human-readable custom ID (slug) and a numeric resource ID
 * within a namespace. Immutable once built.
 */
@RegisterForReflection
public class ResourceMapping {
    /**
     * Sentinel used by GitHub mappings, which have no numeric id. The field stays a primitive
     * {@code int} so internal numeric call sites cannot unbox {@code null}; GitHub stores ignore it.
     */
    public static final int NO_NUMERIC_ID = 0;

    private final String namespace;
    private final String customId;
    private final ResourceType resourceType;
    private final int numericId;
    private final String path;
    private final String variant;

    private ResourceMapping(ResourceMappingBuilder builder) {
        this.namespace = builder.namespace;
        this.customId = builder.customId;
        this.resourceType = builder.resourceType;
        this.numericId = builder.numericId;
        this.path = builder.path;
        this.variant = builder.variant;
    }

    public String getNamespace() {
        return namespace;
    }

    public String getCustomId() {
        return customId;
    }

    public ResourceType getResourceType() {
        return resourceType;
    }

    public int getNumericId() {
        return numericId;
    }

    public String getPath() {
        return path;
    }

    public String getVariant() {
        return variant;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ResourceMapping that = (ResourceMapping) o;
        return numericId == that.numericId && Objects.equals(namespace, that.namespace) && Objects.equals(customId, that.customId)
                && resourceType == that.resourceType && Objects.equals(path, that.path) && Objects.equals(variant, that.variant);
    }

    @Override
    public int hashCode() {
        return Objects.hash(namespace, customId, resourceType, numericId, path, variant);
    }

    @Override
    public String toString() {
        return "ResourceMapping{" +
                "namespace='" + namespace + '\'' +
                ", customId='" + customId + '\'' +
                ", resourceType=" + resourceType +
                ", numericId=" + numericId +
                ", path='" + path + '\'' +
                ", variant='" + variant + '\'' +
                '}';
    }

    /**
     * Builder for the ResourceMapping class.
     */
    public static class ResourceMappingBuilder {
        private String namespace;
        private String customId;
        private ResourceType resourceType;
        private int numericId;
        private String path;
        private String variant;

        public ResourceMappingBuilder setNamespace(String namespace) {
            this.namespace = namespace;
            return this;
        }

        public ResourceMappingBuilder setCustomId(String customId) {
            this.customId = customId;
            return this;
        }

        public ResourceMappingBuilder setResourceType(ResourceType resourceType) {
            this.resourceType = resourceType;
            return this;
        }

        public ResourceMappingBuilder setNumericId(int numericId) {
            this.numericId = numericId;
            return this;
        }

        public ResourceMappingBuilder setPath(String path) {
            this.path = path;
            return this;
        }

        public ResourceMappingBuilder setVariant(String variant) {
            this.variant = variant;
            return this;
        }

        public ResourceMapping build() {
            return new ResourceMapping(this);
        }
    }
}
