package org.finos.calm.domain;

import org.finos.calm.domain.standards.CreateStandardRequest;

import java.util.Objects;

public class Standard extends StandardDetails {
    private String standardJson;
    private String name;
    private String description;
    private Integer id;
    private String namespace;
    private String version;

    public Standard(String name, String description, String standardJson, Integer id, String version) {
        this.name = name;
        this.description = description;
        this.standardJson = standardJson;
        this.id = id;
        this.version = version;
    }

    public Standard(CreateStandardRequest standardRequest) {
        this.name = standardRequest.getName();
        this.description = standardRequest.getDescription();
        this.standardJson = standardRequest.getStandardJson();
    }

    public Standard() {
        // Default constructor
    }

    public String getStandardJson() {
        return standardJson;
    }

    public void setStandardJson(String standardJson) {
        this.standardJson = standardJson;
    }

    @Override
    public String getName() {
        return name;
    }

    @Override
    public void setName(String name) {
        this.name = name;
    }

    @Override
    public String getDescription() {
        return description;
    }

    @Override
    public void setDescription(String description) {
        this.description = description;
    }

    @Override
    public Integer getId() {
        return id;
    }

    @Override
    public void setId(Integer id) {
        this.id = id;
    }

    @Override
    public String getNamespace() {
        return namespace;
    }

    @Override
    public void setNamespace(String namespace) {
        this.namespace = namespace;
    }

    @Override
    public String getVersion() {
        return version;
    }

    @Override
    public void setVersion(String version) {
        this.version = version;
    }

    @Override
    public boolean equals(Object o) {
        if (o == null || getClass() != o.getClass()) return false;
        if (!super.equals(o)) return false;
        Standard standard1 = (Standard) o;
        return Objects.equals(standardJson, standard1.standardJson);
    }

    @Override
    public int hashCode() {
        return Objects.hash(super.hashCode(), standardJson);
    }

}
