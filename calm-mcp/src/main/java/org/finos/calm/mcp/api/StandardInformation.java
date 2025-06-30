package org.finos.calm.mcp.api;

public class StandardInformation {
    private String namespace;
    private String id;
    private String description;

    public StandardInformation(String namespace, String id) {
        this.namespace = namespace;
        this.id = id;
        this.description = "Standard " + id + " in namespace " + namespace + " - Compliance standard or control defining governance requirements and regulations";
    }

    public String getNamespace() {
        return namespace;
    }

    public void setNamespace(String namespace) {
        this.namespace = namespace;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }
}
