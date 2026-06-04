package org.finos.calm.model.canonical;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
class CalmArchitectureSchema {
    private List<CalmNodeSchema> nodes;
    private List<CalmRelationshipSchema> relationships;
    private List<CalmFlowSchema> flows;
    private CalmControlsSchema controls;
    @JsonProperty("metadata") private JsonNode metadataRaw;
    private List<String> adrs;

    public List<CalmNodeSchema> getNodes() { return nodes; }
    public List<CalmRelationshipSchema> getRelationships() { return relationships; }
    public List<CalmFlowSchema> getFlows() { return flows; }
    public CalmControlsSchema getControls() { return controls; }
    public JsonNode getMetadataRaw() { return metadataRaw; }
    public List<String> getAdrs() { return adrs; }
}
