package org.finos.calm.domain.frontcontroller;

import jakarta.validation.constraints.NotBlank;
import java.util.Objects;

public class FrontControllerUpdateRequest {
    @NotBlank(message = "JSON must not be blank")
    private String json;
    @NotBlank(message = "Change type must not be blank")
    private String changeType;

    public FrontControllerUpdateRequest() {
        // Default constructor
    }

    public FrontControllerUpdateRequest(String json, String changeType) {
        this.json = json;
        this.changeType = changeType;
    }

    public String getJson() {
        return json;
    }

    public void setJson(String json) {
        this.json = json;
    }

    public String getChangeType() {
        return changeType;
    }

    public void setChangeType(String changeType) {
        this.changeType = changeType;
    }

    @Override
    public boolean equals(Object o) {
        if (o == null || getClass() != o.getClass()) return false;
        FrontControllerUpdateRequest that = (FrontControllerUpdateRequest) o;
        return Objects.equals(json, that.json) && Objects.equals(changeType, that.changeType);
    }

    @Override
    public int hashCode() {
        return Objects.hash(json, changeType);
    }
}
