package org.finos.calm.model.canonical;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
class CalmControlSchema {
    private String description;
    private List<CalmControlDetailSchema> requirements;

    public String getDescription() { return description; }
    public List<CalmControlDetailSchema> getRequirements() { return requirements; }
}
