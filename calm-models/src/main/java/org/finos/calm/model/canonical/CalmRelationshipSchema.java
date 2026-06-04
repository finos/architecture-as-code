package org.finos.calm.model.canonical;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import org.finos.calm.model.CalmProtocol;

import java.util.HashMap;
import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
public class CalmRelationshipSchema {
    @JsonProperty("unique-id") private String uniqueId;
    private String description;
    @JsonProperty("relationship-type") private CalmRelationshipTypeSchema relationshipType;
    private CalmProtocol protocol;
    private CalmControlsSchema controls;
    @JsonProperty("metadata") private JsonNode metadataRaw;
    private final Map<String, JsonNode> extensions = new HashMap<>();

    @JsonAnySetter
    void setExtension(String key, JsonNode value) {
        extensions.put(key, value);
    }

    public String getUniqueId() { return uniqueId; }
    public String getDescription() { return description; }
    public CalmRelationshipTypeSchema getRelationshipType() { return relationshipType; }
    public CalmProtocol getProtocol() { return protocol; }
    public CalmControlsSchema getControls() { return controls; }
    public JsonNode getMetadataRaw() { return metadataRaw; }
    public Map<String, JsonNode> getExtensions() { return extensions; }
}
