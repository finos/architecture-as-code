package org.finos.calm.model;

import com.fasterxml.jackson.annotation.JsonProperty;

public enum FlowDirection {
    @JsonProperty("source-to-destination")
    SOURCE_TO_DESTINATION,

    @JsonProperty("destination-to-source")
    DESTINATION_TO_SOURCE
}
