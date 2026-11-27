package org.finos.calm.domain;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.quarkus.runtime.annotations.RegisterForReflection;

/**
 * Response projection of {@link ResourceMapping}. {@code numericId} is omitted for GitHub
 * mappings, which have none; keeping it nullable here leaves the internal field a primitive int.
 */
@RegisterForReflection
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ResourceMappingView {
    private final String namespace;
    private final String customId;
    private final ResourceType resourceType;
    private final String id;
    private final Tags tags;
    private final Integer numericId;

    public ResourceMappingView(String namespace, String customId, ResourceType resourceType,
                               String id, Tags tags, Integer numericId) {
        this.namespace = namespace;
        this.customId = customId;
        this.resourceType = resourceType;
        this.id = id;
        this.tags = tags;
        this.numericId = numericId;
    }

    public static ResourceMappingView from(ResourceMapping mapping, boolean gitHub) {
        if (gitHub) {
            return new ResourceMappingView(mapping.getNamespace(), mapping.getCustomId(),
                    mapping.getResourceType(), mapping.getCustomId(),
                    Tags.of(mapping.getPath(), mapping.getVariant()), null);
        }
        String numeric = String.valueOf(mapping.getNumericId());
        return new ResourceMappingView(mapping.getNamespace(), mapping.getCustomId(),
                mapping.getResourceType(), numeric, null, mapping.getNumericId());
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

    public String getId() {
        return id;
    }

    public Tags getTags() {
        return tags;
    }

    public Integer getNumericId() {
        return numericId;
    }
}
