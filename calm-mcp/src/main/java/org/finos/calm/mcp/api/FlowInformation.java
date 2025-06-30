package org.finos.calm.mcp.api;

public class FlowInformation {
    private String namespace;
    private String id;
    private String description;

    public FlowInformation(String namespace, String id) {
        this.namespace = namespace;
        this.id = id;
        this.description = "Flow " + id + " in namespace " + namespace + " - Data or process flow defining how information moves through the system";
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
