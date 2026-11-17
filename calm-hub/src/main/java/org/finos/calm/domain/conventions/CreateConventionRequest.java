package org.finos.calm.domain.conventions;

import java.util.Objects;

public class CreateConventionRequest {
    private String name;
    private String description;
    private String conventionJson;

    public CreateConventionRequest() {
    }

    public CreateConventionRequest(String name, String description, String conventionJson) {
        this.name = name;
        this.description = description;
        this.conventionJson = conventionJson;
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

    public String getConventionJson() {
        return conventionJson;
    }

    public void setConventionJson(String conventionJson) {
        this.conventionJson = conventionJson;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof CreateConventionRequest that)) return false;
        return Objects.equals(name, that.name)
                && Objects.equals(description, that.description)
                && Objects.equals(conventionJson, that.conventionJson);
    }

    @Override
    public int hashCode() {
        return Objects.hash(name, description, conventionJson);
    }
}
