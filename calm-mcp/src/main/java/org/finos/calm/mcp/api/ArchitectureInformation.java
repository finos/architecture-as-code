package org.finos.calm.mcp.api;

public class ArchitectureInformation {
    private String namespace;
    private String id;
    private String description;

    public ArchitectureInformation(String namespace, String id) {
        this.namespace = namespace;
        this.id = id;
        this.description = "Architecture " + id + " in namespace " + namespace + " - System architecture definition describing components, relationships, and design decisions";
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
