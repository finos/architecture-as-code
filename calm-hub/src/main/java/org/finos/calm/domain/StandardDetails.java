package org.finos.calm.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.json.bind.annotation.JsonbTransient;

import java.util.Objects;

public class StandardDetails {
    private String name;
    private String description;
    private Integer id;
    private String namespace;
    private String version;

    public StandardDetails(String name, String description, Integer id , String version) {
        this.name = name;
        this.description = description;
        this.id = id;
        this.version = version;
    }

    public StandardDetails() {
        // Default constructor
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

    @Override
    public boolean equals(Object o) {
        if (o == null || getClass() != o.getClass()) return false;
        StandardDetails that = (StandardDetails) o;
        return Objects.equals(name, that.name) && Objects.equals(description, that.description);
    }

    @Override
    public int hashCode() {
        return Objects.hash(name, description);
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

    @JsonIgnore
    @JsonbTransient
    public String getMongoVersion() {
        return version.replace('.', '-');
    }
}
