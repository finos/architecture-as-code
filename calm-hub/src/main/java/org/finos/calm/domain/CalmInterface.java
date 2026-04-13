package org.finos.calm.domain;

import org.finos.calm.domain.interfaces.CreateInterfaceRequest;

import java.util.Objects;

public class CalmInterface {
    private String interfaceJson;
    private String name;
    private String description;
    private Integer id;
    private String namespace;
    private String version;

    public CalmInterface(String name, String description, String interfaceJson, Integer id, String version) {
        this.name = name;
        this.description = description;
        this.interfaceJson = interfaceJson;
        this.id = id;
        this.version = version;
    }

    public CalmInterface(CreateInterfaceRequest interfaceRequest) {
        this.name = interfaceRequest.getName();
        this.description = interfaceRequest.getDescription();
        this.interfaceJson = interfaceRequest.getInterfaceJson();
    }

    public CalmInterface() {
        // Default constructor
    }

    public String getInterfaceJson() {
        return interfaceJson;
    }

    public void setInterfaceJson(String interfaceJson) {
        this.interfaceJson = interfaceJson;
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
        CalmInterface that = (CalmInterface) o;
        return Objects.equals(interfaceJson, that.interfaceJson) && Objects.equals(name, that.name) && Objects.equals(description, that.description) && Objects.equals(id, that.id) && Objects.equals(namespace, that.namespace) && Objects.equals(version, that.version);
    }

    @Override
    public int hashCode() {
        return Objects.hash(interfaceJson, name, description, id, namespace, version);
    }
}
