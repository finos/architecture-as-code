package org.finos.calm.domain;

import org.finos.calm.domain.buildingblocks.CreateBuildingBlockRequest;

import java.util.Objects;

public class BuildingBlock {
    private String buildingBlockJson;
    private String name;
    private String description;
    private Integer id;
    private String namespace;
    private String version;

    public BuildingBlock(String name, String description, String buildingBlockJson, Integer id, String version) {
        this.name = name;
        this.description = description;
        this.buildingBlockJson = buildingBlockJson;
        this.id = id;
        this.version = version;
    }

    public BuildingBlock(CreateBuildingBlockRequest buildingBlockRequest) {
        this.name = buildingBlockRequest.getName();
        this.description = buildingBlockRequest.getDescription();
        this.buildingBlockJson = buildingBlockRequest.getBuildingBlockJson();
    }

    public BuildingBlock() {
        // Default constructor
    }

    public String getBuildingBlockJson() {
        return buildingBlockJson;
    }

    public void setBuildingBlockJson(String buildingBlockJson) {
        this.buildingBlockJson = buildingBlockJson;
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

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getNamespace() {
        return namespace;
    }

    public void setNamespace(String namespace) {
        this.namespace = namespace;
    }

    public String getVersion() {
        return version;
    }

    public void setVersion(String version) {
        this.version = version;
    }

    @Override
    public boolean equals(Object o) {
        if (o == null || getClass() != o.getClass()) return false;
        BuildingBlock buildingBlock = (BuildingBlock) o;
        return Objects.equals(buildingBlockJson, buildingBlock.buildingBlockJson) && Objects.equals(name, buildingBlock.name) && Objects.equals(description, buildingBlock.description) && Objects.equals(id, buildingBlock.id) && Objects.equals(namespace, buildingBlock.namespace) && Objects.equals(version, buildingBlock.version);
    }

    @Override
    public int hashCode() {
        return Objects.hash(buildingBlockJson, name, description, id, namespace, version);
    }
}
