package org.finos.calm.model.canonical;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public class CalmDecisionSchema {
    private String description;
    private List<String> nodes;
    private List<String> relationships;
    private List<String> controls;
    private List<String> metadata;

    public String getDescription() { return description; }
    public List<String> getNodes() { return nodes; }
    public List<String> getRelationships() { return relationships; }
    public List<String> getControls() { return controls; }
    public List<String> getMetadata() { return metadata; }
}
