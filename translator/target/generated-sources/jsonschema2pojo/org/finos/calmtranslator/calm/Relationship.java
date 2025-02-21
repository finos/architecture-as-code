
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
    "description",
    "relationship-type",
    "protocol",
    "authentication",
    "metadata"
})
@Generated("jsonschema2pojo")
public class Relationship {

    /**
     * 
     * (Required)
     * 
     */
    @JsonProperty("unique-id")
    private String uniqueId;
    @JsonProperty("description")
    private String description;
    /**
     * 
     * (Required)
     * 
     */
    @JsonProperty("relationship-type")
    private RelationshipType relationshipType;
    @JsonProperty("protocol")
    private Relationship.Protocol protocol;
    @JsonProperty("authentication")
    private Relationship.Authentication authentication;
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

    public Relationship withUniqueId(String uniqueId) {
        this.uniqueId = uniqueId;
        return this;
    }

    @JsonProperty("description")
    public String getDescription() {
        return description;
    }

    @JsonProperty("description")
    public void setDescription(String description) {
        this.description = description;
    }

    public Relationship withDescription(String description) {
        this.description = description;
        return this;
    }

    /**
     * 
     * (Required)
     * 
     */
    @JsonProperty("relationship-type")
    public RelationshipType getRelationshipType() {
        return relationshipType;
    }

    /**
     * 
     * (Required)
     * 
     */
    @JsonProperty("relationship-type")
    public void setRelationshipType(RelationshipType relationshipType) {
        this.relationshipType = relationshipType;
    }

    public Relationship withRelationshipType(RelationshipType relationshipType) {
        this.relationshipType = relationshipType;
        return this;
    }

    @JsonProperty("protocol")
    public Relationship.Protocol getProtocol() {
        return protocol;
    }

    @JsonProperty("protocol")
    public void setProtocol(Relationship.Protocol protocol) {
        this.protocol = protocol;
    }

    public Relationship withProtocol(Relationship.Protocol protocol) {
        this.protocol = protocol;
        return this;
    }

    @JsonProperty("authentication")
    public Relationship.Authentication getAuthentication() {
        return authentication;
    }

    @JsonProperty("authentication")
    public void setAuthentication(Relationship.Authentication authentication) {
        this.authentication = authentication;
    }

    public Relationship withAuthentication(Relationship.Authentication authentication) {
        this.authentication = authentication;
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

    public Relationship withMetadata(List<Metadatum> metadata) {
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

    public Relationship withAdditionalProperty(String name, Object value) {
        this.additionalProperties.put(name, value);
        return this;
    }

    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder();
        sb.append(Relationship.class.getName()).append('@').append(Integer.toHexString(System.identityHashCode(this))).append('[');
        sb.append("uniqueId");
        sb.append('=');
        sb.append(((this.uniqueId == null)?"<null>":this.uniqueId));
        sb.append(',');
        sb.append("description");
        sb.append('=');
        sb.append(((this.description == null)?"<null>":this.description));
        sb.append(',');
        sb.append("relationshipType");
        sb.append('=');
        sb.append(((this.relationshipType == null)?"<null>":this.relationshipType));
        sb.append(',');
        sb.append("protocol");
        sb.append('=');
        sb.append(((this.protocol == null)?"<null>":this.protocol));
        sb.append(',');
        sb.append("authentication");
        sb.append('=');
        sb.append(((this.authentication == null)?"<null>":this.authentication));
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
        result = ((result* 31)+((this.protocol == null)? 0 :this.protocol.hashCode()));
        result = ((result* 31)+((this.metadata == null)? 0 :this.metadata.hashCode()));
        result = ((result* 31)+((this.relationshipType == null)? 0 :this.relationshipType.hashCode()));
        result = ((result* 31)+((this.description == null)? 0 :this.description.hashCode()));
        result = ((result* 31)+((this.additionalProperties == null)? 0 :this.additionalProperties.hashCode()));
        result = ((result* 31)+((this.uniqueId == null)? 0 :this.uniqueId.hashCode()));
        result = ((result* 31)+((this.authentication == null)? 0 :this.authentication.hashCode()));
        return result;
    }

    @Override
    public boolean equals(Object other) {
        if (other == this) {
            return true;
        }
        if ((other instanceof Relationship) == false) {
            return false;
        }
        Relationship rhs = ((Relationship) other);
        return ((((((((this.protocol == rhs.protocol)||((this.protocol!= null)&&this.protocol.equals(rhs.protocol)))&&((this.metadata == rhs.metadata)||((this.metadata!= null)&&this.metadata.equals(rhs.metadata))))&&((this.relationshipType == rhs.relationshipType)||((this.relationshipType!= null)&&this.relationshipType.equals(rhs.relationshipType))))&&((this.description == rhs.description)||((this.description!= null)&&this.description.equals(rhs.description))))&&((this.additionalProperties == rhs.additionalProperties)||((this.additionalProperties!= null)&&this.additionalProperties.equals(rhs.additionalProperties))))&&((this.uniqueId == rhs.uniqueId)||((this.uniqueId!= null)&&this.uniqueId.equals(rhs.uniqueId))))&&((this.authentication == rhs.authentication)||((this.authentication!= null)&&this.authentication.equals(rhs.authentication))));
    }

    @Generated("jsonschema2pojo")
    public enum Authentication {

        BASIC("Basic"),
        O_AUTH_2("OAuth2"),
        KERBEROS("Kerberos"),
        SPNEGO("SPNEGO"),
        CERTIFICATE("Certificate");
        private final String value;
        private final static Map<String, Relationship.Authentication> CONSTANTS = new HashMap<String, Relationship.Authentication>();

        static {
            for (Relationship.Authentication c: values()) {
                CONSTANTS.put(c.value, c);
            }
        }

        Authentication(String value) {
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
        public static Relationship.Authentication fromValue(String value) {
            Relationship.Authentication constant = CONSTANTS.get(value);
            if (constant == null) {
                throw new IllegalArgumentException(value);
            } else {
                return constant;
            }
        }

    }

    @Generated("jsonschema2pojo")
    public enum Protocol {

        HTTP("HTTP"),
        HTTPS("HTTPS"),
        FTP("FTP"),
        SFTP("SFTP"),
        JDBC("JDBC"),
        WEB_SOCKET("WebSocket"),
        SOCKET_IO("SocketIO"),
        LDAP("LDAP"),
        AMQP("AMQP"),
        TLS("TLS"),
        M_TLS("mTLS"),
        TCP("TCP");
        private final String value;
        private final static Map<String, Relationship.Protocol> CONSTANTS = new HashMap<String, Relationship.Protocol>();

        static {
            for (Relationship.Protocol c: values()) {
                CONSTANTS.put(c.value, c);
            }
        }

        Protocol(String value) {
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
        public static Relationship.Protocol fromValue(String value) {
            Relationship.Protocol constant = CONSTANTS.get(value);
            if (constant == null) {
                throw new IllegalArgumentException(value);
            } else {
                return constant;
            }
        }

    }

}
