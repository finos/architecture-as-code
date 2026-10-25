package org.finos.calm.model.canonical;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CalmDecoratorSchema {
    @JsonProperty("$schema") private String schema;
    @JsonProperty("unique-id") private String uniqueId;
    private String type;
    @JsonProperty("target-type") private List<String> targetType;
    private List<String> target;
    @JsonProperty("applies-to") private List<String> appliesTo;
    private JsonNode data;

    public String getSchema() { return schema; }
    public String getUniqueId() { return uniqueId; }
    public String getType() { return type; }
    public List<String> getTargetType() { return targetType; }
    public List<String> getTarget() { return target; }
    public List<String> getAppliesTo() { return appliesTo; }
    public JsonNode getData() { return data; }
}
