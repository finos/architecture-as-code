
package org.finos.calmtranslator.calm;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import javax.annotation.processing.Generated;
import com.fasterxml.jackson.annotation.JsonAnyGetter;
import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;


/**
 * Common Architecture Language Model (CALM) Vocab
 * <p>
 * 
 * 
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonPropertyOrder({
    "nodes",
    "relationships",
    "metadata"
})
@Generated("jsonschema2pojo")
public class Core {

    @JsonProperty("nodes")
    private List<Node> nodes = new ArrayList<Node>();
    @JsonProperty("relationships")
    private List<Relationship> relationships = new ArrayList<Relationship>();
    @JsonProperty("metadata")
    private List<Metadatum> metadata = new ArrayList<Metadatum>();
    @JsonIgnore
    private Map<String, Object> additionalProperties = new LinkedHashMap<String, Object>();

    @JsonProperty("nodes")
    public List<Node> getNodes() {
        return nodes;
    }

    @JsonProperty("nodes")
    public void setNodes(List<Node> nodes) {
        this.nodes = nodes;
    }

    public Core withNodes(List<Node> nodes) {
        this.nodes = nodes;
        return this;
    }

    @JsonProperty("relationships")
    public List<Relationship> getRelationships() {
        return relationships;
    }

    @JsonProperty("relationships")
    public void setRelationships(List<Relationship> relationships) {
        this.relationships = relationships;
    }

    public Core withRelationships(List<Relationship> relationships) {
        this.relationships = relationships;
        return this;
    }

    @JsonProperty("metadata")
    public List<Metadatum> getMetadata() {
        return metadata;
    }

    @JsonProperty("metadata")
    public void setMetadata(List<Metadatum> metadata) {
        this.metadata = metadata;
    }

    public Core withMetadata(List<Metadatum> metadata) {
        this.metadata = metadata;
        return this;
    }

    @JsonAnyGetter
    public Map<String, Object> getAdditionalProperties() {
        return this.additionalProperties;
    }

    @JsonAnySetter
    public void setAdditionalProperty(String name, Object value) {
        this.additionalProperties.put(name, value);
    }

    public Core withAdditionalProperty(String name, Object value) {
        this.additionalProperties.put(name, value);
        return this;
    }

    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder();
        sb.append(Core.class.getName()).append('@').append(Integer.toHexString(System.identityHashCode(this))).append('[');
        sb.append("nodes");
        sb.append('=');
        sb.append(((this.nodes == null)?"<null>":this.nodes));
        sb.append(',');
        sb.append("relationships");
        sb.append('=');
        sb.append(((this.relationships == null)?"<null>":this.relationships));
        sb.append(',');
        sb.append("metadata");
        sb.append('=');
        sb.append(((this.metadata == null)?"<null>":this.metadata));
        sb.append(',');
        sb.append("additionalProperties");
        sb.append('=');
        sb.append(((this.additionalProperties == null)?"<null>":this.additionalProperties));
        sb.append(',');
        if (sb.charAt((sb.length()- 1)) == ',') {
            sb.setCharAt((sb.length()- 1), ']');
        } else {
            sb.append(']');
        }
        return sb.toString();
    }

    @Override
    public int hashCode() {
        int result = 1;
        result = ((result* 31)+((this.relationships == null)? 0 :this.relationships.hashCode()));
        result = ((result* 31)+((this.metadata == null)? 0 :this.metadata.hashCode()));
        result = ((result* 31)+((this.nodes == null)? 0 :this.nodes.hashCode()));
        result = ((result* 31)+((this.additionalProperties == null)? 0 :this.additionalProperties.hashCode()));
        return result;
    }

    @Override
    public boolean equals(Object other) {
        if (other == this) {
            return true;
        }
        if ((other instanceof Core) == false) {
            return false;
        }
        Core rhs = ((Core) other);
        return (((((this.relationships == rhs.relationships)||((this.relationships!= null)&&this.relationships.equals(rhs.relationships)))&&((this.metadata == rhs.metadata)||((this.metadata!= null)&&this.metadata.equals(rhs.metadata))))&&((this.nodes == rhs.nodes)||((this.nodes!= null)&&this.nodes.equals(rhs.nodes))))&&((this.additionalProperties == rhs.additionalProperties)||((this.additionalProperties!= null)&&this.additionalProperties.equals(rhs.additionalProperties))));
    }

}
