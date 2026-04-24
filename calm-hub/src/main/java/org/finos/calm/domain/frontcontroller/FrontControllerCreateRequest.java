package org.finos.calm.domain.frontcontroller;

import jakarta.validation.constraints.NotBlank;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import java.util.Objects;

public class FrontControllerCreateRequest {
    @NotBlank(message = "Type must not be blank")
    @Schema(description = "Resource type (e.g. PATTERN, ARCHITECTURE, FLOW, STANDARD, INTERFACE). Required for initial creation.", required = true, example = "ARCHITECTURE")
    private String type;
    @NotBlank(message = "JSON must not be blank")
    @Schema(description = "The CALM document JSON content.", required = true)
    private String json;
    @Schema(description = "Human-readable name for the resource (optional).")
    private String name;
    @Schema(description = "Description of the resource (optional).")
    private String description;

    public FrontControllerCreateRequest() {
        // Default constructor
    }

    public FrontControllerCreateRequest(String type, String json, String name, String description) {
        this.type = type;
        this.json = json;
        this.name = name;
        this.description = description;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getJson() {
        return json;
    }

    public void setJson(String json) {
        this.json = json;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    @Override
    public boolean equals(Object o) {
        if (o == null || getClass() != o.getClass()) return false;
        FrontControllerCreateRequest that = (FrontControllerCreateRequest) o;
        return Objects.equals(type, that.type) && Objects.equals(json, that.json) && Objects.equals(name, that.name) && Objects.equals(description, that.description);
    }

    @Override
    public int hashCode() {
        return Objects.hash(type, json, name, description);
    }
}
