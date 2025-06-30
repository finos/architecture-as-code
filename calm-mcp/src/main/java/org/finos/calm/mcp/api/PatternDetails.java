package org.finos.calm.mcp.api;

public class PatternDetails {
    private String namespace;
    private int patternId;
    private String version;
    private Object pattern;
    private String description;

    public PatternDetails(String namespace, int patternId, String version, Object pattern) {
        this.namespace = namespace;
        this.patternId = patternId;
        this.version = version;
        this.pattern = pattern;
        this.description = "Full pattern " + patternId + " version " + version + " in namespace " + namespace;
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

    public Object getPattern() {
        return pattern;
    }

    public void setPattern(Object pattern) {
        this.pattern = pattern;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }
}
