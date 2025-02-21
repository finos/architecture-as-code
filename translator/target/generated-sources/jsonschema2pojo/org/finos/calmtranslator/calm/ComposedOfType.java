
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
    "container",
    "nodes"
})
@Generated("jsonschema2pojo")
public class ComposedOfType {

    /**
     * 
     * (Required)
     * 
     */
    @JsonProperty("container")
    private String container;
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
    @JsonProperty("container")
    public String getContainer() {
        return container;
    }

    /**
     * 
     * (Required)
     * 
     */
    @JsonProperty("container")
    public void setContainer(String container) {
        this.container = container;
    }

    public ComposedOfType withContainer(String container) {
        this.container = container;
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

    public ComposedOfType withNodes(List<String> nodes) {
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

    public ComposedOfType withAdditionalProperty(String name, Object value) {
        this.additionalProperties.put(name, value);
        return this;
    }

    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder();
        sb.append(ComposedOfType.class.getName()).append('@').append(Integer.toHexString(System.identityHashCode(this))).append('[');
        sb.append("container");
        sb.append('=');
        sb.append(((this.container == null)?"<null>":this.container));
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
        result = ((result* 31)+((this.container == null)? 0 :this.container.hashCode()));
        result = ((result* 31)+((this.nodes == null)? 0 :this.nodes.hashCode()));
        result = ((result* 31)+((this.additionalProperties == null)? 0 :this.additionalProperties.hashCode()));
        return result;
    }

    @Override
    public boolean equals(Object other) {
        if (other == this) {
            return true;
        }
        if ((other instanceof ComposedOfType) == false) {
            return false;
        }
        ComposedOfType rhs = ((ComposedOfType) other);
        return ((((this.container == rhs.container)||((this.container!= null)&&this.container.equals(rhs.container)))&&((this.nodes == rhs.nodes)||((this.nodes!= null)&&this.nodes.equals(rhs.nodes))))&&((this.additionalProperties == rhs.additionalProperties)||((this.additionalProperties!= null)&&this.additionalProperties.equals(rhs.additionalProperties))));
    }

}
