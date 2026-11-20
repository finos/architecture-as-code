package org.finos.calm.domain.adr;

import io.quarkus.runtime.annotations.RegisterForReflection;

import java.util.Objects;

@RegisterForReflection
public class NamespaceAdrSummary {
    private String title;
    private String status;
    private Integer id;
    private String slug;

    public NamespaceAdrSummary(String title, String status, Integer id) {
        this(title, status, id, null);
    }

    public NamespaceAdrSummary(String title, String status, Integer id, String slug) {
        this.title = title;
        this.status = status;
        this.id = id;
        this.slug = slug;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getSlug() {
        return slug;
    }

    public void setSlug(String slug) {
        this.slug = slug;
    }

    @Override
    public boolean equals(Object o) {
        if (o == null || getClass() != o.getClass()) return false;
        NamespaceAdrSummary that = (NamespaceAdrSummary) o;
        return Objects.equals(title, that.title) && Objects.equals(status, that.status)
                && Objects.equals(id, that.id) && Objects.equals(slug, that.slug);
    }

    @Override
    public int hashCode() {
        return Objects.hash(title, status, id, slug);
    }

    @Override
    public String toString() {
        return "NamespaceAdrSummary[title=" + title + ", status=" + status + ", id=" + id + ", slug=" + slug + ']';
    }
}
