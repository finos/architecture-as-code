package org.finos.calm.mcp.api.architectures;

public class ArchitecturesInformation {
    private String name;
    private String description;

    public ArchitecturesInformation(String name) {
        this.name = name;
        this.description = "Architecture " + name + " represents a numerical ID for a CALM architecture";
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
}
