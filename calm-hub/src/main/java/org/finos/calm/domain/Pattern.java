package org.finos.calm.domain;

import java.util.Objects;
import org.finos.calm.domain.patterns.CreatePatternRequest;

/**
 * Represents an architecture and the associated namespace, id, and version.
 */
public class Pattern {
    private String patternJson;
    private String name;
    private String description;
    private Integer id;
    private String namespace;
    private String version;

    public Pattern(String name, String description, String patternJson, Integer id, String version) {
         this.name = name;
        this.description = description;
        this.standardJson = patternJson;
        this.id = id;
        this.version = version;
    }

        public Pattern(CreatePatternRequest patternRequest) {
        this.name = patternRequest.getName();
        this.description = patternRequest.getDescription();
        this.patternJson = patternRequest.getPatternJson();
    }

    public Pattern() {
        // Default constructor
    }

    /**
     * Returns the pattern in JSON format.
     * @return the pattern in JSON format
     */
    public String getPatternJson() {
        return patternJson;
    }

    /**
     * Returns the pattern in JSON format.
     * @return the pattern in JSON format
     */
    public void setPatternJson(String patternJson) {
        this.patternJson = patternJson;
    }

    /**
     * Returns the name of the pattern.
     * @return the name of the pattern
     */
    public String getName() {
        return name;
    }

    /**
     * Sets the name of the pattern.
     * @param name the name of the pattern
     */
    public void setName(String name) {
        this.name = name;
    }

    /**
     * Returns the description of the pattern.
     * @return the description of the pattern
     */
    public String getDescription() {
        return description;
    }

    /**
     * Sets the description of the pattern.
     * @param description the description of the pattern
     */
    public void setDescription(String description) {
        this.description = description;
    }

    /**
     * Returns the id of the pattern.
     * @return the id of the pattern
     */
    public int getId() {
        return id;
    }

    /**
     * Sets the id of the pattern.
     * @param id the id of the pattern
     */
    public void setId(int id) {
        this.id = id;
    }


    /**
     * Returns the namespace of the pattern.
     * @return the namespace of the pattern
     */
    public String getNamespace() {
        return namespace;
    }

    /**
     * Sets the namespace of the pattern.
     * @param namespace the namespace of the pattern
     */
    public void setNamespace(String namespace) {
        this.namespace = namespace;
    }

    /**
     * Returns the version of the pattern as it should be reflected to the external world.
     * @return the version of the pattern with dot format, e.g. 1.0.0
     */
    public String getVersion() {
        return version;
    }

    /**
     * Sets the version of the pattern as it should be reflected to the external world, e.g. 1.0.0
     */
    public void setVersion(String version) {
        this.version = version;
    }

    @Override
    public boolean equals(Object o) {
        if (o == null || getClass() != o.getClass()) return false;
        Pattern pattern = (Pattern) o;
        return Objects.equals(patternJson, pattern.patternJson) && Objects.equals(name, pattern.name) && Objects.equals(description, pattern.description) && Objects.equals(id, pattern.id) && Objects.equals(namespace, pattern.namespace) && Objects.equals(version, pattern.version);
    }

    @Override
    public int hashCode() {
        return Objects.hash(patternJson, name, description, id, namespace, version);
    }
}
