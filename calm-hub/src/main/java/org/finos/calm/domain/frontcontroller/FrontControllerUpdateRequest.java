package org.finos.calm.domain.frontcontroller;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import java.util.Objects;

public class FrontControllerUpdateRequest {
    @NotBlank(message = "JSON must not be blank")
    @Schema(description = "The updated CALM document JSON content.", required = true)
    private String json;
    @NotNull(message = "Change type must not be null")
    @Schema(description = "Semver bump to apply: MAJOR, MINOR, or PATCH.", required = true, example = "MINOR")
    private ChangeType changeType;

    public FrontControllerUpdateRequest() {
        // Default constructor
    }

    public FrontControllerUpdateRequest(String json, ChangeType changeType) {
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
        FrontControllerUpdateRequest that = (FrontControllerUpdateRequest) o;
        return Objects.equals(json, that.json) && changeType == that.changeType;
    }

    @Override
    public int hashCode() {
        return Objects.hash(json, changeType);
    }
}
