package org.finos.calm.domain.buildingblocks;

import java.util.Objects;

public class CreateBuildingBlockRequest {
    private String name;
    private String description;
    private String buildingBlockJson;

    public CreateBuildingBlockRequest(String name, String description, String buildingBlockJson) {
        this.name = name;
        this.description = description;
        this.buildingBlockJson = buildingBlockJson;
    }

    public CreateBuildingBlockRequest() {
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

    public String getBuildingBlockJson() {
        return buildingBlockJson;
    }

    public void setBuildingBlockJson(String buildingBlockJson) {
        this.buildingBlockJson = buildingBlockJson;
    }

    @Override
    public boolean equals(Object o) {
        if (o == null || getClass() != o.getClass()) return false;
        CreateBuildingBlockRequest that = (CreateBuildingBlockRequest) o;
        return Objects.equals(name, that.name) && Objects.equals(description, that.description) && Objects.equals(buildingBlockJson, that.buildingBlockJson);
    }

    @Override
    public int hashCode() {
        return Objects.hash(name, description, buildingBlockJson);
    }
}
