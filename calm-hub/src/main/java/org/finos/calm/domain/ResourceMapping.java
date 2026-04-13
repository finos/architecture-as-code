package org.finos.calm.domain;

import java.util.Objects;

/**
 * Represents a mapping between a human-readable custom ID (slug) and a numeric resource ID
 * within a namespace. Immutable once built.
 */
public class ResourceMapping {
    private final String namespace;
    private final String customId;
    private final ResourceType resourceType;
    private final int numericId;

    private ResourceMapping(ResourceMappingBuilder builder) {
        this.namespace = builder.namespace;
        this.customId = builder.customId;
        this.resourceType = builder.resourceType;
        this.numericId = builder.numericId;
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

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ResourceMapping that = (ResourceMapping) o;
        return numericId == that.numericId && Objects.equals(namespace, that.namespace) && Objects.equals(customId, that.customId) && resourceType == that.resourceType;
    }

    @Override
    public int hashCode() {
        return Objects.hash(namespace, customId, resourceType, numericId);
    }

    @Override
    public String toString() {
        return "ResourceMapping{" +
                "namespace='" + namespace + '\'' +
                ", customId='" + customId + '\'' +
                ", resourceType=" + resourceType +
                ", numericId=" + numericId +
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

        public ResourceMapping build() {
            return new ResourceMapping(this);
        }
    }
}
