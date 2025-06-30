package org.finos.calm.mcp.api;

public class PatternInformation {
    private String namespace;
    private String id;
    private String description;

    public PatternInformation(String namespace, String id) {
        this.namespace = namespace;
        this.id = id;
        this.description = "Pattern " + id + " in namespace " + namespace + " - Architectural pattern providing reusable solutions to common design problems";
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
