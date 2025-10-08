package org.finos.calm.domain.architecture;

import java.util.Objects;

public class ArchitectureRequest {

    private String name;
    private String description;
    private String architectureJson;

    public ArchitectureRequest() {
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

    public String getArchitectureJson() {
        return architectureJson;
    }

    public void setArchitectureJson(String architectureJson) {
        this.architectureJson = architectureJson;
    }

    @Override
    public boolean equals(Object o) {
        if (o == null || getClass() != o.getClass()) return false;
        ArchitectureRequest that = (ArchitectureRequest) o;
        return Objects.equals(name, that.name) && Objects.equals(description, that.description) && Objects.equals(architectureJson, that.architectureJson);
    }

    @Override
    public int hashCode() {
        return Objects.hash(name, description, architectureJson);
    }

    @Override
    public String toString() {
        return "ArchitectureRequest{" +
                "name='" + name + '\'' +
                ", description='" + description + '\'' +
                ", architectureJson='" + architectureJson + '\'' +
                '}';
    }
}