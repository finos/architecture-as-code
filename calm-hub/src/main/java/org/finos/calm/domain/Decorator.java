package org.finos.calm.domain;

import java.util.List;
import java.util.Objects;

/**
 * Represents a decorator in the CALM system.
 * A decorator contains metadata and properties that can be applied to architectures or other elements.
 */
public class Decorator {
    private String schema;
    private String uniqueId;
    private String type;
    private List<String> target;
    private List<String> targetType;
    private List<String> appliesTo;
    private Object data;

    public Decorator() {
    }

    /**
     * Returns the JSON schema identifier for this decorator.
     *
     * @return the schema URI string, or null if not set
     */
    public String getSchema() {
        return schema;
    }

    /**
     * Sets the JSON schema identifier for this decorator.
     *
     * @param schema the schema URI string
     */
    public void setSchema(String schema) {
        this.schema = schema;
    }

    /**
     * Returns the unique identifier of this decorator.
     *
     * @return the unique identifier, or null if not set
     */
    public String getUniqueId() {
        return uniqueId;
    }

    /**
     * Sets the unique identifier of this decorator.
     *
     * @param uniqueId the unique identifier
     */
    public void setUniqueId(String uniqueId) {
        this.uniqueId = uniqueId;
    }

    /**
     * Returns the type of this decorator (e.g. "deployment").
     *
     * @return the decorator type, or null if not set
     */
    public String getType() {
        return type;
    }

    /**
     * Sets the type of this decorator (e.g. "deployment").
     *
     * @param type the decorator type
     */
    public void setType(String type) {
        this.type = type;
    }

    /**
     * Returns the list of targets this decorator applies to.
     * Each entry is a path to a CALM Hub resource, e.g. {@code /calm/namespaces/finos/architectures/1/versions/1-0-0}.
     *
     * @return the list of target paths, or null if not set
     */
    public List<String> getTarget() {
        return target;
    }

    /**
     * Sets the list of targets this decorator applies to.
     *
     * @param target the list of target paths
     */
    public void setTarget(List<String> target) {
        this.target = target;
    }

    /**
     * Returns the list of target types this decorator can be applied to (e.g. "architecture", "pattern").
     * This field is optional.
     *
     * @return the list of target types, or null if not set
     */
    public List<String> getTargetType() {
        return targetType;
    }

    /**
     * Sets the list of target types this decorator can be applied to.
     *
     * @param targetType the list of target type strings
     */
    public void setTargetType(List<String> targetType) {
        this.targetType = targetType;
    }

    /**
     * Returns the list of node IDs within a target that this decorator applies to.
     * This field is optional.
     *
     * @return the list of node identifiers, or null if not set
     */
    public List<String> getAppliesTo() {
        return appliesTo;
    }

    /**
     * Sets the list of node IDs within a target that this decorator applies to.
     *
     * @param appliesTo the list of node identifiers
     */
    public void setAppliesTo(List<String> appliesTo) {
        this.appliesTo = appliesTo;
    }

    /**
     * Returns the decorator-specific data payload.
     * The structure of this object depends on the decorator type.
     *
     * @return the data payload, or null if not set
     */
    public Object getData() {
        return data;
    }

    /**
     * Sets the decorator-specific data payload.
     *
     * @param data the data payload
     */
    public void setData(Object data) {
        this.data = data;
    }

    @Override
    public boolean equals(Object o) {
        if (o == null || getClass() != o.getClass()) return false;
        Decorator that = (Decorator) o;
        return Objects.equals(schema, that.schema)
                && Objects.equals(uniqueId, that.uniqueId)
                && Objects.equals(type, that.type)
                && Objects.equals(target, that.target)
                && Objects.equals(targetType, that.targetType)
                && Objects.equals(appliesTo, that.appliesTo)
                && Objects.equals(data, that.data);
    }

    @Override
    public int hashCode() {
        return Objects.hash(schema, uniqueId, type, target, targetType, appliesTo, data);
    }

    @Override
    public String toString() {
        return "Decorator{" +
                "schema='" + schema + '\'' +
                ", uniqueId='" + uniqueId + '\'' +
                ", type='" + type + '\'' +
                ", target=" + target +
                ", targetType=" + targetType +
                ", appliesTo=" + appliesTo +
                ", data=" + data +
                '}';
    }
}
