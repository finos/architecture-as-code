package org.finos.calm.model.canonical;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
class CalmNodeSchema {
    @JsonProperty("unique-id") private String uniqueId;
    @JsonProperty("node-type") private String nodeType;
    private String name;
    private String description;
    private CalmNodeDetailsSchema details;
    @JsonProperty("interfaces") private List<JsonNode> interfaces;
    private CalmControlsSchema controls;
    @JsonProperty("metadata") private JsonNode metadataRaw;
    private final Map<String, JsonNode> extensions = new HashMap<>();

    @JsonAnySetter
    void setExtension(String key, JsonNode value) {
        extensions.put(key, value);
    }

    public String getUniqueId() { return uniqueId; }
    public String getNodeType() { return nodeType; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public CalmNodeDetailsSchema getDetails() { return details; }
    public List<JsonNode> getInterfaces() { return interfaces; }
    public CalmControlsSchema getControls() { return controls; }
    public JsonNode getMetadataRaw() { return metadataRaw; }
    public Map<String, JsonNode> getExtensions() { return extensions; }
}
