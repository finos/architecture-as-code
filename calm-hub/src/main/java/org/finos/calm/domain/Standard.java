package org.finos.calm.domain;

import java.util.Objects;

public class Standard extends StandardDetails {
    private String standard;
    private String namespace;
    private String version;

    public Standard(String name, String description, String standard, Integer id) {
        super(name, description, id);
        this.standard = standard;
    }

    public Standard() {
        // Default constructor
    }

    public Standard(String standard) {
        this.standard = standard;
    }

    public String getStandard() {
        return standard;
    }

    public void setStandard(String standard) {
        this.standard = standard;
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
        if (!super.equals(o)) return false;
        Standard standard1 = (Standard) o;
        return Objects.equals(standard, standard1.standard);
    }

    @Override
    public int hashCode() {
        return Objects.hash(super.hashCode(), standard);
    }
}
