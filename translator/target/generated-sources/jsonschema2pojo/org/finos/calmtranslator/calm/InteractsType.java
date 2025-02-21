
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

@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonPropertyOrder({
    "actor",
    "nodes"
})
@Generated("jsonschema2pojo")
public class InteractsType {

    /**
     * 
     * (Required)
     * 
     */
    @JsonProperty("actor")
    private String actor;
    /**
     * 
     * (Required)
     * 
     */
    @JsonProperty("nodes")
    private List<String> nodes = new ArrayList<String>();
    @JsonIgnore
    private Map<String, Object> additionalProperties = new LinkedHashMap<String, Object>();

    /**
     * 
     * (Required)
     * 
     */
    @JsonProperty("actor")
    public String getActor() {
        return actor;
    }

    /**
     * 
     * (Required)
     * 
     */
    @JsonProperty("actor")
    public void setActor(String actor) {
        this.actor = actor;
    }

    public InteractsType withActor(String actor) {
        this.actor = actor;
        return this;
    }

    /**
     * 
     * (Required)
     * 
     */
    @JsonProperty("nodes")
    public List<String> getNodes() {
        return nodes;
    }

    /**
     * 
     * (Required)
     * 
     */
    @JsonProperty("nodes")
    public void setNodes(List<String> nodes) {
        this.nodes = nodes;
    }

    public InteractsType withNodes(List<String> nodes) {
        this.nodes = nodes;
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

    public InteractsType withAdditionalProperty(String name, Object value) {
        this.additionalProperties.put(name, value);
        return this;
    }

    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder();
        sb.append(InteractsType.class.getName()).append('@').append(Integer.toHexString(System.identityHashCode(this))).append('[');
        sb.append("actor");
        sb.append('=');
        sb.append(((this.actor == null)?"<null>":this.actor));
        sb.append(',');
        sb.append("nodes");
        sb.append('=');
        sb.append(((this.nodes == null)?"<null>":this.nodes));
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
        result = ((result* 31)+((this.actor == null)? 0 :this.actor.hashCode()));
        result = ((result* 31)+((this.nodes == null)? 0 :this.nodes.hashCode()));
        result = ((result* 31)+((this.additionalProperties == null)? 0 :this.additionalProperties.hashCode()));
        return result;
    }

    @Override
    public boolean equals(Object other) {
        if (other == this) {
            return true;
        }
        if ((other instanceof InteractsType) == false) {
            return false;
        }
        InteractsType rhs = ((InteractsType) other);
        return ((((this.actor == rhs.actor)||((this.actor!= null)&&this.actor.equals(rhs.actor)))&&((this.nodes == rhs.nodes)||((this.nodes!= null)&&this.nodes.equals(rhs.nodes))))&&((this.additionalProperties == rhs.additionalProperties)||((this.additionalProperties!= null)&&this.additionalProperties.equals(rhs.additionalProperties))));
    }

}
