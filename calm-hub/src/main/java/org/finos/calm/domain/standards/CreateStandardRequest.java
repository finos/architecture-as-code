package org.finos.calm.domain.standards;

import java.util.Objects;

public class CreateStandardRequest {
    private String name;
    private String description;
    private String standardJson;

    public CreateStandardRequest(String name, String description, String standardJson) {
        this.name = name;
        this.description = description;
        this.standardJson = standardJson;
    }

    public CreateStandardRequest() {
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

    public String getStandardJson() {
        return standardJson;
    }

    public void setStandardJson(String standardJson) {
        this.standardJson = standardJson;
    }

    @Override
    public boolean equals(Object o) {
        if (o == null || getClass() != o.getClass()) return false;
        CreateStandardRequest that = (CreateStandardRequest) o;
        return Objects.equals(name, that.name) && Objects.equals(description, that.description) && Objects.equals(standardJson, that.standardJson);
    }

    @Override
    public int hashCode() {
        return Objects.hash(name, description, standardJson);
    }
}
