package org.finos.calm.model.canonical;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
class CalmNodeDetailsSchema {
    @JsonProperty("detailed-architecture") private String detailedArchitecture;
    @JsonProperty("required-pattern") private String requiredPattern;

    public String getDetailedArchitecture() { return detailedArchitecture; }
    public String getRequiredPattern() { return requiredPattern; }
}
