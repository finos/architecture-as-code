package org.finos.calm.domain.mapping;

import jakarta.validation.constraints.NotBlank;
import java.util.Objects;

public class MappingCreateRequest {
    @NotBlank(message = "Type must not be blank")
    private String type;
    @NotBlank(message = "JSON must not be blank")
    private String json;
    private String name;
    private String description;

    public MappingCreateRequest() {
        // Default constructor
    }

    public MappingCreateRequest(String type, String json, String name, String description) {
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
        MappingCreateRequest that = (MappingCreateRequest) o;
        return Objects.equals(type, that.type) && Objects.equals(json, that.json) && Objects.equals(name, that.name) && Objects.equals(description, that.description);
    }

    @Override
    public int hashCode() {
        return Objects.hash(type, json, name, description);
    }
}
