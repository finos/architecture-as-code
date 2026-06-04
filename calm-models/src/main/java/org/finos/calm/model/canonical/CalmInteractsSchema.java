package org.finos.calm.model.canonical;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
class CalmInteractsSchema {
    private String actor;
    private List<String> nodes;

    public String getActor() { return actor; }
    public List<String> getNodes() { return nodes; }
}
