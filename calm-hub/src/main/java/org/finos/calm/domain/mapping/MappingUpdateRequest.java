package org.finos.calm.domain.mapping;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.Objects;

public class MappingUpdateRequest {
    @NotBlank(message = "JSON must not be blank")
    private String json;
    @NotNull(message = "Change type must not be null")
    private ChangeType changeType;

    public MappingUpdateRequest() {
        // Default constructor
    }

    public MappingUpdateRequest(String json, ChangeType changeType) {
        this.json = json;
        this.changeType = changeType;
    }

    public String getJson() {
        return json;
    }

    public void setJson(String json) {
        this.json = json;
    }

    public ChangeType getChangeType() {
        return changeType;
    }

    public void setChangeType(ChangeType changeType) {
        this.changeType = changeType;
    }

    @Override
    public boolean equals(Object o) {
        if (o == null || getClass() != o.getClass()) return false;
        MappingUpdateRequest that = (MappingUpdateRequest) o;
        return Objects.equals(json, that.json) && changeType == that.changeType;
    }

    @Override
    public int hashCode() {
        return Objects.hash(json, changeType);
    }
}
