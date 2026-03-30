package org.finos.calm.domain.controls;

import jakarta.validation.constraints.NotBlank;

import java.util.Objects;

public class CreateControlRequirement {
    @NotBlank(message = "name must not be blank")
    private String name;

    @NotBlank(message = "description must not be blank")
    private String description;

    @NotBlank(message = "requirementJson must not be blank")
    private String requirementJson;

    public CreateControlRequirement(String name, String description, String requirementJson) {
        this.name = name;
        this.description = description;
        this.requirementJson = requirementJson;
    }

    public CreateControlRequirement() {
        //Default constructor
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

    public String getRequirementJson() {
        return requirementJson;
    }

    public void setRequirementJson(String requirementJson) {
        this.requirementJson = requirementJson;
    }

    @Override
    public boolean equals(Object o) {
        if (o == null || getClass() != o.getClass()) return false;
        CreateControlRequirement that = (CreateControlRequirement) o;
        return Objects.equals(name, that.name) && Objects.equals(description, that.description) && Objects.equals(requirementJson, that.requirementJson);
    }

    @Override
    public int hashCode() {
        return Objects.hash(name, description, requirementJson);
    }
}