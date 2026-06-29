package org.finos.calm.model.canonical;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;

@JsonIgnoreProperties(ignoreUnknown = true)
public class CalmControlDetailSchema {
    @JsonProperty("requirement-url") private String requirementUrl;
    @JsonProperty("config-url") private String configUrl;
    @JsonProperty("config") private JsonNode configRaw;

    public String getRequirementUrl() { return requirementUrl; }
    public String getConfigUrl() { return configUrl; }
    public JsonNode getConfigRaw() { return configRaw; }
}
