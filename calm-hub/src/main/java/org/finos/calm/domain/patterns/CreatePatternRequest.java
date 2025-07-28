package org.finos.calm.domain.patterns;

import java.util.Objects;

public class CreatePatternRequest {
    private String name;
    private String description;
    private String patternJson;

    public CreatePatternRequest(String name, String description, String patternJson) {
        this.name = name;
        this.description = description;
        this.patternJson = patternJson;
    }

    public CreatePatternRequest() {
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

    public String getPatternJson() {
        return patternJson;
    }

    public void setPatternJson(String patternJson) {
        this.patternJson = patternJson;
    }

    @Override
    public boolean equals(Object o) {
        if (o == null || getClass() != o.getClass()) return false;
        CreatePatternRequest that = (CreatePatternRequest) o;
        return Objects.equals(name, that.name) && Objects.equals(description, that.description) && Objects.equals(patternJson, that.patternJson);
    }

    @Override
    public int hashCode() {
        return Objects.hash(name, description, patternJson);
    }
}
