package org.finos.calm.domain;

import org.finos.calm.domain.standards.CreateStandardRequest;

import java.util.Objects;

public class Standard {
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
        Standard standard = (Standard) o;
        return Objects.equals(standardJson, standard.standardJson) && Objects.equals(name, standard.name) && Objects.equals(description, standard.description) && Objects.equals(id, standard.id) && Objects.equals(namespace, standard.namespace) && Objects.equals(version, standard.version);
    }

    @Override
    public int hashCode() {
        return Objects.hash(standardJson, name, description, id, namespace, version);
    }
}
