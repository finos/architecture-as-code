package org.finos.calm.domain.namespaces;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.quarkus.runtime.annotations.RegisterForReflection;
import org.finos.calm.domain.CustomIdentifiable;
import org.finos.calm.domain.Tags;

import java.util.Objects;

@RegisterForReflection
public class NamespaceResourceSummary implements CustomIdentifiable {
    private String name;
    private String description;
    private String id;
    private int versionCount;
    private String customId;
    private Tags tags;

    public NamespaceResourceSummary(String name, String description, Integer id, int versionCount) {
        this(name, description, id == null ? null : String.valueOf(id), versionCount, null);
    }

    public NamespaceResourceSummary(String name, String description, String id, int versionCount) {
        this(name, description, id, versionCount, null);
    }

    public NamespaceResourceSummary(String name, String description, Tags tags, String id, int versionCount) {
        this(name, description, id, versionCount, tags);
    }

    private NamespaceResourceSummary(String name, String description, String id, int versionCount, Tags tags) {
        this.name = name;
        this.description = description;
        this.id = id;
        this.versionCount = versionCount;
        this.tags = tags;
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
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public void setId(Integer id) {
        this.id = id == null ? null : String.valueOf(id);
    }

    public int getVersionCount() {
        return versionCount;
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public Tags getTags() {
        return tags;
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
        return versionCount == that.versionCount && Objects.equals(name, that.name) && Objects.equals(description, that.description) && Objects.equals(id, that.id) && Objects.equals(customId, that.customId) && Objects.equals(tags, that.tags);
    }

    @Override
    public int hashCode() {
        return Objects.hash(name, description, id, versionCount, customId, tags);
    }
}
