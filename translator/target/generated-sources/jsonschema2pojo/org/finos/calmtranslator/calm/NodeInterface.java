
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
    "node",
    "interfaces"
})
@Generated("jsonschema2pojo")
public class NodeInterface {

    /**
     * 
     * (Required)
     * 
     */
    @JsonProperty("node")
    private String node;
    @JsonProperty("interfaces")
    private List<String> interfaces = new ArrayList<String>();
    @JsonIgnore
    private Map<String, Object> additionalProperties = new LinkedHashMap<String, Object>();

    /**
     * 
     * (Required)
     * 
     */
    @JsonProperty("node")
    public String getNode() {
        return node;
    }

    /**
     * 
     * (Required)
     * 
     */
    @JsonProperty("node")
    public void setNode(String node) {
        this.node = node;
    }

    public NodeInterface withNode(String node) {
        this.node = node;
        return this;
    }

    @JsonProperty("interfaces")
    public List<String> getInterfaces() {
        return interfaces;
    }

    @JsonProperty("interfaces")
    public void setInterfaces(List<String> interfaces) {
        this.interfaces = interfaces;
    }

    public NodeInterface withInterfaces(List<String> interfaces) {
        this.interfaces = interfaces;
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

    public NodeInterface withAdditionalProperty(String name, Object value) {
        this.additionalProperties.put(name, value);
        return this;
    }

    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder();
        sb.append(NodeInterface.class.getName()).append('@').append(Integer.toHexString(System.identityHashCode(this))).append('[');
        sb.append("node");
        sb.append('=');
        sb.append(((this.node == null)?"<null>":this.node));
        sb.append(',');
        sb.append("interfaces");
        sb.append('=');
        sb.append(((this.interfaces == null)?"<null>":this.interfaces));
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
        result = ((result* 31)+((this.node == null)? 0 :this.node.hashCode()));
        result = ((result* 31)+((this.interfaces == null)? 0 :this.interfaces.hashCode()));
        result = ((result* 31)+((this.additionalProperties == null)? 0 :this.additionalProperties.hashCode()));
        return result;
    }

    @Override
    public boolean equals(Object other) {
        if (other == this) {
            return true;
        }
        if ((other instanceof NodeInterface) == false) {
            return false;
        }
        NodeInterface rhs = ((NodeInterface) other);
        return ((((this.node == rhs.node)||((this.node!= null)&&this.node.equals(rhs.node)))&&((this.interfaces == rhs.interfaces)||((this.interfaces!= null)&&this.interfaces.equals(rhs.interfaces))))&&((this.additionalProperties == rhs.additionalProperties)||((this.additionalProperties!= null)&&this.additionalProperties.equals(rhs.additionalProperties))));
    }

}
