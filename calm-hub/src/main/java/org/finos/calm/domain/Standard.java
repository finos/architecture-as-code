package org.finos.calm.domain;

import java.util.Objects;

public class Standard extends StandardDetails {
    private String standard;
    private String namespace;

    public Standard(String name, String description, String standard, Integer id, String version) {
        super(name, description, id, version);
        this.standard = standard;
    }

    public Standard() {
        // Default constructor
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
