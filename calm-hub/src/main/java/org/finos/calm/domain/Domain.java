package org.finos.calm.domain;

/**
 * Represents a domain in the CALM system.
 * A domain is a logical grouping of controls and shared control schemas
 */
public class Domain {

    /**
     * Constructor to create a Domain with a specified name.
     *
     * @param name the name of the domain
     */
    public Domain(String name) {
        this.name = name;
    }

    /**
     * Default constructor for Domain.
     * This constructor is used for deserialization purposes.
     */
    public Domain() {

    }

    private String name;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }
}
