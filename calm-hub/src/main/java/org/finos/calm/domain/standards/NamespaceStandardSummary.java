package org.finos.calm.domain.standards;

import java.util.Objects;

public class NamespaceStandardSummary {
    private String name;
    private String description;
    private Integer id;

    public NamespaceStandardSummary(String name, String description, Integer id) {
        this.name = name;
        this.description = description;
        this.id = id;
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
        NamespaceStandardSummary that = (NamespaceStandardSummary) o;
        return Objects.equals(name, that.name) && Objects.equals(description, that.description) && Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(name, description, id);
    }
}
