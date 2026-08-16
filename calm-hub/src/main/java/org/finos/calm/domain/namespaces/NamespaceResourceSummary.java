package org.finos.calm.domain.namespaces;

import io.quarkus.runtime.annotations.RegisterForReflection;
import org.finos.calm.domain.CustomIdentifiable;

import java.util.Objects;

@RegisterForReflection
public class NamespaceResourceSummary implements CustomIdentifiable {
    private String name;
    private String description;
    private Integer id;
    private int versionCount;
    private String customId;

    public NamespaceResourceSummary(String name, String description, Integer id, int versionCount) {
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

    @Override
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
    public String getCustomId() {
        return customId;
    }

    @Override
    public void setCustomId(String customId) {
        this.customId = customId;
    }

    @Override
    public boolean equals(Object o) {
        if (o == null || getClass() != o.getClass()) return false;
        NamespaceResourceSummary that = (NamespaceResourceSummary) o;
        return versionCount == that.versionCount && Objects.equals(name, that.name) && Objects.equals(description, that.description) && Objects.equals(id, that.id) && Objects.equals(customId, that.customId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(name, description, id, versionCount, customId);
    }
}
