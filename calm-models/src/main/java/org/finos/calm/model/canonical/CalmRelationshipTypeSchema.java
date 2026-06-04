package org.finos.calm.model.canonical;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
class CalmRelationshipTypeSchema {
    private CalmConnectsSchema connects;
    private CalmInteractsSchema interacts;
    @JsonProperty("deployed-in") private CalmDeployedInSchema deployedIn;
    @JsonProperty("composed-of") private CalmComposedOfSchema composedOf;
    private List<CalmDecisionSchema> options;

    public CalmConnectsSchema getConnects() { return connects; }
    public CalmInteractsSchema getInteracts() { return interacts; }
    public CalmDeployedInSchema getDeployedIn() { return deployedIn; }
    public CalmComposedOfSchema getComposedOf() { return composedOf; }
    public List<CalmDecisionSchema> getOptions() { return options; }
}
