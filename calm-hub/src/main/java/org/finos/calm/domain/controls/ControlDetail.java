package org.finos.calm.domain.controls;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.quarkus.runtime.annotations.RegisterForReflection;
import org.finos.calm.domain.Tags;

import java.util.Objects;

@RegisterForReflection
public class ControlDetail {
    private String id;
    private String name;
    private String description;
    private String title;
    private Tags tags;

    public ControlDetail() {
    }

    public ControlDetail(Integer id, String name, String description) {
        this(id == null ? null : String.valueOf(id), name, description, null, null);
    }

    public ControlDetail(String id, String name, String description) {
        this(id, name, description, null, null);
    }

    public ControlDetail(Integer id, String name, String description, String title) {
        this(id == null ? null : String.valueOf(id), name, description, title, null);
    }

    public ControlDetail(String id, String name, String description, String title) {
        this(id, name, description, title, null);
    }

    public ControlDetail(String id, String name, String description, String title, Tags tags) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.title = title;
        this.tags = tags;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public void setId(Integer id) {
        this.id = id == null ? null : String.valueOf(id);
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

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public Tags getTags() {
        return tags;
    }

    public void setTags(Tags tags) {
        this.tags = tags;
    }

    @Override
    public boolean equals(Object o) {
        if (o == null || getClass() != o.getClass()) return false;
        ControlDetail that = (ControlDetail) o;
        return Objects.equals(id, that.id) && Objects.equals(name, that.name) && Objects.equals(description, that.description) && Objects.equals(title, that.title) && Objects.equals(tags, that.tags);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, name, description, title, tags);
    }
}
