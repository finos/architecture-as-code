package org.finos.calm.domain.controls;

import java.util.Objects;

public class ControlDetail {
    private Integer id;
    private String name;
    private String description;
    private String title;

    public ControlDetail() {

    }

    public ControlDetail(Integer id, String name, String description) {
        this.id = id;
        this.name = name;
        this.description = description;
    }

    public ControlDetail(Integer id, String name, String description, String title) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.title = title;
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
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

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    @Override
    public boolean equals(Object o) {
        if (o == null || getClass() != o.getClass()) return false;
        ControlDetail that = (ControlDetail) o;
        return Objects.equals(id, that.id) && Objects.equals(name, that.name) && Objects.equals(description, that.description) && Objects.equals(title, that.title);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, name, description, title);
    }
}
