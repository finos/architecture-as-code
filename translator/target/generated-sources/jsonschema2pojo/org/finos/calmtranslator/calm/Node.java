
package org.finos.calmtranslator.calm;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import javax.annotation.processing.Generated;
import com.fasterxml.jackson.annotation.JsonAnyGetter;
import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import com.fasterxml.jackson.annotation.JsonValue;

@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonPropertyOrder({
    "unique-id",
    "node-type",
    "name",
    "description",
    "detailed-architecture",
    "data-classification",
    "run-as",
    "instance",
    "interfaces",
    "metadata"
})
@Generated("jsonschema2pojo")
public class Node {

    /**
     * 
     * (Required)
     * 
     */
    @JsonProperty("unique-id")
    private String uniqueId;
    /**
     * 
     * (Required)
     * 
     */
    @JsonProperty("node-type")
    private Node.NodeTypeDefinition nodeType;
    /**
     * 
     * (Required)
     * 
     */
    @JsonProperty("name")
    private String name;
    /**
     * 
     * (Required)
     * 
     */
    @JsonProperty("description")
    private String description;
    @JsonProperty("detailed-architecture")
    private String detailedArchitecture;
    @JsonProperty("data-classification")
    private Node.DataClassification dataClassification;
    @JsonProperty("run-as")
    private String runAs;
    @JsonProperty("instance")
    private String instance;
    @JsonProperty("interfaces")
    private List<InterfaceType> interfaces = new ArrayList<InterfaceType>();
    @JsonProperty("metadata")
    private List<Metadatum> metadata = new ArrayList<Metadatum>();
    @JsonIgnore
    private Map<String, Object> additionalProperties = new LinkedHashMap<String, Object>();

    /**
     * 
     * (Required)
     * 
     */
    @JsonProperty("unique-id")
    public String getUniqueId() {
        return uniqueId;
    }

    /**
     * 
     * (Required)
     * 
     */
    @JsonProperty("unique-id")
    public void setUniqueId(String uniqueId) {
        this.uniqueId = uniqueId;
    }

    public Node withUniqueId(String uniqueId) {
        this.uniqueId = uniqueId;
        return this;
    }

    /**
     * 
     * (Required)
     * 
     */
    @JsonProperty("node-type")
    public Node.NodeTypeDefinition getNodeType() {
        return nodeType;
    }

    /**
     * 
     * (Required)
     * 
     */
    @JsonProperty("node-type")
    public void setNodeType(Node.NodeTypeDefinition nodeType) {
        this.nodeType = nodeType;
    }

    public Node withNodeType(Node.NodeTypeDefinition nodeType) {
        this.nodeType = nodeType;
        return this;
    }

    /**
     * 
     * (Required)
     * 
     */
    @JsonProperty("name")
    public String getName() {
        return name;
    }

    /**
     * 
     * (Required)
     * 
     */
    @JsonProperty("name")
    public void setName(String name) {
        this.name = name;
    }

    public Node withName(String name) {
        this.name = name;
        return this;
    }

    /**
     * 
     * (Required)
     * 
     */
    @JsonProperty("description")
    public String getDescription() {
        return description;
    }

    /**
     * 
     * (Required)
     * 
     */
    @JsonProperty("description")
    public void setDescription(String description) {
        this.description = description;
    }

    public Node withDescription(String description) {
        this.description = description;
        return this;
    }

    @JsonProperty("detailed-architecture")
    public String getDetailedArchitecture() {
        return detailedArchitecture;
    }

    @JsonProperty("detailed-architecture")
    public void setDetailedArchitecture(String detailedArchitecture) {
        this.detailedArchitecture = detailedArchitecture;
    }

    public Node withDetailedArchitecture(String detailedArchitecture) {
        this.detailedArchitecture = detailedArchitecture;
        return this;
    }

    @JsonProperty("data-classification")
    public Node.DataClassification getDataClassification() {
        return dataClassification;
    }

    @JsonProperty("data-classification")
    public void setDataClassification(Node.DataClassification dataClassification) {
        this.dataClassification = dataClassification;
    }

    public Node withDataClassification(Node.DataClassification dataClassification) {
        this.dataClassification = dataClassification;
        return this;
    }

    @JsonProperty("run-as")
    public String getRunAs() {
        return runAs;
    }

    @JsonProperty("run-as")
    public void setRunAs(String runAs) {
        this.runAs = runAs;
    }

    public Node withRunAs(String runAs) {
        this.runAs = runAs;
        return this;
    }

    @JsonProperty("instance")
    public String getInstance() {
        return instance;
    }

    @JsonProperty("instance")
    public void setInstance(String instance) {
        this.instance = instance;
    }

    public Node withInstance(String instance) {
        this.instance = instance;
        return this;
    }

    @JsonProperty("interfaces")
    public List<InterfaceType> getInterfaces() {
        return interfaces;
    }

    @JsonProperty("interfaces")
    public void setInterfaces(List<InterfaceType> interfaces) {
        this.interfaces = interfaces;
    }

    public Node withInterfaces(List<InterfaceType> interfaces) {
        this.interfaces = interfaces;
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

    public Node withMetadata(List<Metadatum> metadata) {
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

    public Node withAdditionalProperty(String name, Object value) {
        this.additionalProperties.put(name, value);
        return this;
    }

    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder();
        sb.append(Node.class.getName()).append('@').append(Integer.toHexString(System.identityHashCode(this))).append('[');
        sb.append("uniqueId");
        sb.append('=');
        sb.append(((this.uniqueId == null)?"<null>":this.uniqueId));
        sb.append(',');
        sb.append("nodeType");
        sb.append('=');
        sb.append(((this.nodeType == null)?"<null>":this.nodeType));
        sb.append(',');
        sb.append("name");
        sb.append('=');
        sb.append(((this.name == null)?"<null>":this.name));
        sb.append(',');
        sb.append("description");
        sb.append('=');
        sb.append(((this.description == null)?"<null>":this.description));
        sb.append(',');
        sb.append("detailedArchitecture");
        sb.append('=');
        sb.append(((this.detailedArchitecture == null)?"<null>":this.detailedArchitecture));
        sb.append(',');
        sb.append("dataClassification");
        sb.append('=');
        sb.append(((this.dataClassification == null)?"<null>":this.dataClassification));
        sb.append(',');
        sb.append("runAs");
        sb.append('=');
        sb.append(((this.runAs == null)?"<null>":this.runAs));
        sb.append(',');
        sb.append("instance");
        sb.append('=');
        sb.append(((this.instance == null)?"<null>":this.instance));
        sb.append(',');
        sb.append("interfaces");
        sb.append('=');
        sb.append(((this.interfaces == null)?"<null>":this.interfaces));
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
        result = ((result* 31)+((this.detailedArchitecture == null)? 0 :this.detailedArchitecture.hashCode()));
        result = ((result* 31)+((this.runAs == null)? 0 :this.runAs.hashCode()));
        result = ((result* 31)+((this.interfaces == null)? 0 :this.interfaces.hashCode()));
        result = ((result* 31)+((this.metadata == null)? 0 :this.metadata.hashCode()));
        result = ((result* 31)+((this.instance == null)? 0 :this.instance.hashCode()));
        result = ((result* 31)+((this.dataClassification == null)? 0 :this.dataClassification.hashCode()));
        result = ((result* 31)+((this.name == null)? 0 :this.name.hashCode()));
        result = ((result* 31)+((this.description == null)? 0 :this.description.hashCode()));
        result = ((result* 31)+((this.additionalProperties == null)? 0 :this.additionalProperties.hashCode()));
        result = ((result* 31)+((this.nodeType == null)? 0 :this.nodeType.hashCode()));
        result = ((result* 31)+((this.uniqueId == null)? 0 :this.uniqueId.hashCode()));
        return result;
    }

    @Override
    public boolean equals(Object other) {
        if (other == this) {
            return true;
        }
        if ((other instanceof Node) == false) {
            return false;
        }
        Node rhs = ((Node) other);
        return ((((((((((((this.detailedArchitecture == rhs.detailedArchitecture)||((this.detailedArchitecture!= null)&&this.detailedArchitecture.equals(rhs.detailedArchitecture)))&&((this.runAs == rhs.runAs)||((this.runAs!= null)&&this.runAs.equals(rhs.runAs))))&&((this.interfaces == rhs.interfaces)||((this.interfaces!= null)&&this.interfaces.equals(rhs.interfaces))))&&((this.metadata == rhs.metadata)||((this.metadata!= null)&&this.metadata.equals(rhs.metadata))))&&((this.instance == rhs.instance)||((this.instance!= null)&&this.instance.equals(rhs.instance))))&&((this.dataClassification == rhs.dataClassification)||((this.dataClassification!= null)&&this.dataClassification.equals(rhs.dataClassification))))&&((this.name == rhs.name)||((this.name!= null)&&this.name.equals(rhs.name))))&&((this.description == rhs.description)||((this.description!= null)&&this.description.equals(rhs.description))))&&((this.additionalProperties == rhs.additionalProperties)||((this.additionalProperties!= null)&&this.additionalProperties.equals(rhs.additionalProperties))))&&((this.nodeType == rhs.nodeType)||((this.nodeType!= null)&&this.nodeType.equals(rhs.nodeType))))&&((this.uniqueId == rhs.uniqueId)||((this.uniqueId!= null)&&this.uniqueId.equals(rhs.uniqueId))));
    }

    @Generated("jsonschema2pojo")
    public enum DataClassification {

        PUBLIC("Public"),
        CONFIDENTIAL("Confidential"),
        HIGHLY_RESTRICTED("Highly Restricted"),
        MNPI("MNPI"),
        PII("PII");
        private final String value;
        private final static Map<String, Node.DataClassification> CONSTANTS = new HashMap<String, Node.DataClassification>();

        static {
            for (Node.DataClassification c: values()) {
                CONSTANTS.put(c.value, c);
            }
        }

        DataClassification(String value) {
            this.value = value;
        }

        @Override
        public String toString() {
            return this.value;
        }

        @JsonValue
        public String value() {
            return this.value;
        }

        @JsonCreator
        public static Node.DataClassification fromValue(String value) {
            Node.DataClassification constant = CONSTANTS.get(value);
            if (constant == null) {
                throw new IllegalArgumentException(value);
            } else {
                return constant;
            }
        }

    }

    @Generated("jsonschema2pojo")
    public enum NodeTypeDefinition {

        ACTOR("actor"),
        SYSTEM("system"),
        SERVICE("service"),
        DATABASE("database"),
        NETWORK("network"),
        LDAP("ldap"),
        WEBCLIENT("webclient");
        private final String value;
        private final static Map<String, Node.NodeTypeDefinition> CONSTANTS = new HashMap<String, Node.NodeTypeDefinition>();

        static {
            for (Node.NodeTypeDefinition c: values()) {
                CONSTANTS.put(c.value, c);
            }
        }

        NodeTypeDefinition(String value) {
            this.value = value;
        }

        @Override
        public String toString() {
            return this.value;
        }

        @JsonValue
        public String value() {
            return this.value;
        }

        @JsonCreator
        public static Node.NodeTypeDefinition fromValue(String value) {
            Node.NodeTypeDefinition constant = CONSTANTS.get(value);
            if (constant == null) {
                throw new IllegalArgumentException(value);
            } else {
                return constant;
            }
        }

    }

}
