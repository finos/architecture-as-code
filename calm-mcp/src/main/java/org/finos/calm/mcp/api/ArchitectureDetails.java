package org.finos.calm.mcp.api;

public class ArchitectureDetails {
    private String namespace;
    private int architectureId;
    private String version;
    private Object architecture;
    private String description;

    public ArchitectureDetails(String namespace, int architectureId, String version, Object architecture) {
        this.namespace = namespace;
        this.architectureId = architectureId;
        this.version = version;
        this.architecture = architecture;
        this.description = "Full architecture " + architectureId + " version " + version + " in namespace " + namespace;
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

    public Object getArchitecture() {
        return architecture;
    }

    public void setArchitecture(Object architecture) {
        this.architecture = architecture;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }
}
