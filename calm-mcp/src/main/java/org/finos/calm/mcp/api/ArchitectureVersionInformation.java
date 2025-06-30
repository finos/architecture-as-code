package org.finos.calm.mcp.api;

public class ArchitectureVersionInformation {
    private String namespace;
    private int architectureId;
    private String version;
    private String description;

    public ArchitectureVersionInformation(String namespace, int architectureId, String version) {
        this.namespace = namespace;
        this.architectureId = architectureId;
        this.version = version;
        this.description = "Version " + version + " of architecture " + architectureId + " in namespace " + namespace;
    }

    public String getNamespace() {
        return namespace;
    }

    public void setNamespace(String namespace) {
        this.namespace = namespace;
    }

    public int getArchitectureId() {
        return architectureId;
    }

    public void setArchitectureId(int architectureId) {
        this.architectureId = architectureId;
    }

    public String getVersion() {
        return version;
    }

    public void setVersion(String version) {
        this.version = version;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }
}
