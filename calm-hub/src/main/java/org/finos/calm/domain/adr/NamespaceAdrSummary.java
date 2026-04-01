package org.finos.calm.domain.adr;

import java.util.Objects;

public class NamespaceAdrSummary {
    private String title;
    private String status;
    private Integer id;

    public NamespaceAdrSummary(String title, String status, Integer id) {
        this.title = title;
        this.status = status;
        this.id = id;
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

    @Override
    public boolean equals(Object o) {
        if (o == null || getClass() != o.getClass()) return false;
        NamespaceAdrSummary that = (NamespaceAdrSummary) o;
        return Objects.equals(title, that.title) && Objects.equals(status, that.status) && Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(title, status, id);
    }
}
