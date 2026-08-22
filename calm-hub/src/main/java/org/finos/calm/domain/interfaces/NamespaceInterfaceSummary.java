package org.finos.calm.domain.interfaces;

import io.quarkus.runtime.annotations.RegisterForReflection;
import org.finos.calm.domain.CustomIdentifiable;

import java.util.Objects;

@RegisterForReflection
public class NamespaceInterfaceSummary implements CustomIdentifiable {
    private String name;
    private String description;
    private Integer id;
    private String customId;

    public NamespaceInterfaceSummary(String name, String description, Integer id) {
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

    @Override
    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
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
        NamespaceInterfaceSummary that = (NamespaceInterfaceSummary) o;
        return Objects.equals(name, that.name) && Objects.equals(description, that.description) && Objects.equals(id, that.id) && Objects.equals(customId, that.customId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(name, description, id, customId);
    }
}
