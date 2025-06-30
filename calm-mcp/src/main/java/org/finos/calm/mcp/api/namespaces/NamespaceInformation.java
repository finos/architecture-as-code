package org.finos.calm.mcp.api.namespaces;

public class NamespaceInformation {
    private String name;
    private String description;

    public NamespaceInformation(String name) {
        this.name = name;
        this.description = "Namespace " + name + " grouping associated CALM documents together under ownership. For example patterns, architectures";
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
