package org.finos.calm.domain;

import java.util.Objects;

public class Standard extends StandardDetails {
    private String standardJson;

    public Standard(String name, String description, String standardJson, Integer id, String version) {
        super(name, description, id, version);
        this.standardJson = standardJson;
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
