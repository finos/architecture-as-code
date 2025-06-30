package org.finos.calm.mcp.api.architecture;

public class ArchitectureInformation {
    private String document;
    private String description;

    public ArchitectureInformation(String document) {
        this.document = document;
        this.description = "Architecture " + document + " represents a software architecture defined using CALM";
    }

    public String getDocument() {
        return document;
    }

    public void setDocument(String document) {
        this.document = document;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }
}
