package org.finos.calm.domain.pattern;

import io.quarkus.runtime.annotations.RegisterForReflection;

import java.util.Objects;

@RegisterForReflection
public class NamespacePatternSummary {
    private String name;
    private String description;
    private Integer id;
    private int versionCount;

    public NamespacePatternSummary(String name, String description, Integer id, int versionCount) {
        this.name = name;
        this.description = description;
        this.id = id;
        this.versionCount = versionCount;
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

    public int getVersionCount() {
        return versionCount;
    }

    @Override
    public boolean equals(Object o) {
        if (o == null || getClass() != o.getClass()) return false;
        NamespacePatternSummary that = (NamespacePatternSummary) o;
        return versionCount == that.versionCount && Objects.equals(name, that.name) && Objects.equals(description, that.description) && Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(name, description, id, versionCount);
    }
}
