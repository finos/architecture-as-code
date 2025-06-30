package org.finos.calm.mcp.api;

public class PatternVersionInformation {
    private String namespace;
    private int patternId;
    private String version;
    private String description;

    public PatternVersionInformation(String namespace, int patternId, String version) {
        this.namespace = namespace;
        this.patternId = patternId;
        this.version = version;
        this.description = "Version " + version + " of pattern " + patternId + " in namespace " + namespace;
    }

    public String getNamespace() {
        return namespace;
    }

    public void setNamespace(String namespace) {
        this.namespace = namespace;
    }

    public int getPatternId() {
        return patternId;
    }

    public void setPatternId(int patternId) {
        this.patternId = patternId;
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
