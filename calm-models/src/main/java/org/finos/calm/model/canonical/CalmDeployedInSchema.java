package org.finos.calm.model.canonical;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
class CalmDeployedInSchema {
    private String container;
    private List<String> nodes;

    public String getContainer() { return container; }
    public List<String> getNodes() { return nodes; }
}
