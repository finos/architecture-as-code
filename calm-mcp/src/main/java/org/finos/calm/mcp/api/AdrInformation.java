package org.finos.calm.mcp.api;

public class AdrInformation {
    private String namespace;
    private Integer id;
    private String description;

    public AdrInformation(String namespace, Integer id) {
        this.namespace = namespace;
        this.id = id;
        this.description = "ADR " + id + " in namespace " + namespace + " - Architecture Decision Record documenting architectural decisions and their rationale";
    }

    public String getNamespace() {
        return namespace;
    }

    public void setNamespace(String namespace) {
        this.namespace = namespace;
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }
}
