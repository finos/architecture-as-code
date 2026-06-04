package org.finos.calm.model.canonical;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public class CalmFlowSchema {
    @JsonProperty("unique-id") private String uniqueId;
    private String name;
    private String description;
    @JsonProperty("requirement-url") private String requirementUrl;
    private List<CalmFlowTransitionSchema> transitions;
    private CalmControlsSchema controls;
    @JsonProperty("metadata") private JsonNode metadataRaw;

    public String getUniqueId() { return uniqueId; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public String getRequirementUrl() { return requirementUrl; }
    public List<CalmFlowTransitionSchema> getTransitions() { return transitions; }
    public CalmControlsSchema getControls() { return controls; }
    public JsonNode getMetadataRaw() { return metadataRaw; }
}
