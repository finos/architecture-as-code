package org.finos.calm.domain.mapping;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.Objects;

public class MappingLinkRequest {
    @NotBlank(message = "Type must not be blank")
    private String type;
    @NotNull(message = "Resource ID must not be null")
    private Integer resourceId;

    public MappingLinkRequest() {
        // Default constructor
    }

    public MappingLinkRequest(String type, Integer resourceId) {
        this.type = type;
        this.resourceId = resourceId;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public Integer getResourceId() {
        return resourceId;
    }

    public void setResourceId(Integer resourceId) {
        this.resourceId = resourceId;
    }

    @Override
    public boolean equals(Object o) {
        if (o == null || getClass() != o.getClass()) return false;
        MappingLinkRequest that = (MappingLinkRequest) o;
        return Objects.equals(type, that.type) && Objects.equals(resourceId, that.resourceId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(type, resourceId);
    }
}
