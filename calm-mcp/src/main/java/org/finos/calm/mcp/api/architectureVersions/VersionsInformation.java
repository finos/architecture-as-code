package org.finos.calm.mcp.api.architectureVersions;

public class VersionsInformation {
    private String name;
    private String description;

    public VersionsInformation(String name) {
        this.name = name;
        this.description = "Version " + name + " represents a semantic version of a CALM resource. For example 1.0.0 or 1.4.2 as a more recent version.";
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
