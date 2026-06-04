package org.finos.calm.model.canonical;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.finos.calm.model.FlowDirection;

@JsonIgnoreProperties(ignoreUnknown = true)
public class CalmFlowTransitionSchema {
    @JsonProperty("relationship-unique-id") private String relationshipUniqueId;
    @JsonProperty("sequence-number") private int sequenceNumber;
    private String description;
    private FlowDirection direction;

    public String getRelationshipUniqueId() { return relationshipUniqueId; }
    public int getSequenceNumber() { return sequenceNumber; }
    public String getDescription() { return description; }
    public FlowDirection getDirection() { return direction; }
}
