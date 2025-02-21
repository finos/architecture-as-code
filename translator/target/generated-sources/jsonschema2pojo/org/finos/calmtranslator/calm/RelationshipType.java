
package org.finos.calmtranslator.calm;

import java.util.LinkedHashMap;
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
    "interacts",
    "connects",
    "deployed-in",
    "composed-of"
})
@Generated("jsonschema2pojo")
public class RelationshipType {

    @JsonProperty("interacts")
    private InteractsType interacts;
    @JsonProperty("connects")
    private ConnectsType connects;
    @JsonProperty("deployed-in")
    private DeployedInType deployedIn;
    @JsonProperty("composed-of")
    private ComposedOfType composedOf;
    @JsonIgnore
    private Map<String, Object> additionalProperties = new LinkedHashMap<String, Object>();

    @JsonProperty("interacts")
    public InteractsType getInteracts() {
        return interacts;
    }

    @JsonProperty("interacts")
    public void setInteracts(InteractsType interacts) {
        this.interacts = interacts;
    }

    public RelationshipType withInteracts(InteractsType interacts) {
        this.interacts = interacts;
        return this;
    }

    @JsonProperty("connects")
    public ConnectsType getConnects() {
        return connects;
    }

    @JsonProperty("connects")
    public void setConnects(ConnectsType connects) {
        this.connects = connects;
    }

    public RelationshipType withConnects(ConnectsType connects) {
        this.connects = connects;
        return this;
    }

    @JsonProperty("deployed-in")
    public DeployedInType getDeployedIn() {
        return deployedIn;
    }

    @JsonProperty("deployed-in")
    public void setDeployedIn(DeployedInType deployedIn) {
        this.deployedIn = deployedIn;
    }

    public RelationshipType withDeployedIn(DeployedInType deployedIn) {
        this.deployedIn = deployedIn;
        return this;
    }

    @JsonProperty("composed-of")
    public ComposedOfType getComposedOf() {
        return composedOf;
    }

    @JsonProperty("composed-of")
    public void setComposedOf(ComposedOfType composedOf) {
        this.composedOf = composedOf;
    }

    public RelationshipType withComposedOf(ComposedOfType composedOf) {
        this.composedOf = composedOf;
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

    public RelationshipType withAdditionalProperty(String name, Object value) {
        this.additionalProperties.put(name, value);
        return this;
    }

    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder();
        sb.append(RelationshipType.class.getName()).append('@').append(Integer.toHexString(System.identityHashCode(this))).append('[');
        sb.append("interacts");
        sb.append('=');
        sb.append(((this.interacts == null)?"<null>":this.interacts));
        sb.append(',');
        sb.append("connects");
        sb.append('=');
        sb.append(((this.connects == null)?"<null>":this.connects));
        sb.append(',');
        sb.append("deployedIn");
        sb.append('=');
        sb.append(((this.deployedIn == null)?"<null>":this.deployedIn));
        sb.append(',');
        sb.append("composedOf");
        sb.append('=');
        sb.append(((this.composedOf == null)?"<null>":this.composedOf));
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
        result = ((result* 31)+((this.connects == null)? 0 :this.connects.hashCode()));
        result = ((result* 31)+((this.composedOf == null)? 0 :this.composedOf.hashCode()));
        result = ((result* 31)+((this.additionalProperties == null)? 0 :this.additionalProperties.hashCode()));
        result = ((result* 31)+((this.deployedIn == null)? 0 :this.deployedIn.hashCode()));
        result = ((result* 31)+((this.interacts == null)? 0 :this.interacts.hashCode()));
        return result;
    }

    @Override
    public boolean equals(Object other) {
        if (other == this) {
            return true;
        }
        if ((other instanceof RelationshipType) == false) {
            return false;
        }
        RelationshipType rhs = ((RelationshipType) other);
        return ((((((this.connects == rhs.connects)||((this.connects!= null)&&this.connects.equals(rhs.connects)))&&((this.composedOf == rhs.composedOf)||((this.composedOf!= null)&&this.composedOf.equals(rhs.composedOf))))&&((this.additionalProperties == rhs.additionalProperties)||((this.additionalProperties!= null)&&this.additionalProperties.equals(rhs.additionalProperties))))&&((this.deployedIn == rhs.deployedIn)||((this.deployedIn!= null)&&this.deployedIn.equals(rhs.deployedIn))))&&((this.interacts == rhs.interacts)||((this.interacts!= null)&&this.interacts.equals(rhs.interacts))));
    }

}
