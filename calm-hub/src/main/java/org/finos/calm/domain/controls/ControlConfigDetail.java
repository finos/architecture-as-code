package org.finos.calm.domain.controls;

import java.util.Objects;

/**
 * Lightweight projection returned by the User Facing API that pairs a configuration's
 * numeric storage id with its human-readable name slug.
 */
public class ControlConfigDetail {

    private Integer id;
    private String name;
    private String title;

    public ControlConfigDetail() {}

    public ControlConfigDetail(Integer id, String name) {
        this.id = id;
        this.name = name;
    }

    public ControlConfigDetail(Integer id, String name, String title) {
        this.id = id;
        this.name = name;
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

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    @Override
    public boolean equals(Object o) {
        if (o == null || getClass() != o.getClass()) return false;
        ControlConfigDetail that = (ControlConfigDetail) o;
        return Objects.equals(id, that.id) && Objects.equals(name, that.name) && Objects.equals(title, that.title);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, name, title);
    }
}
