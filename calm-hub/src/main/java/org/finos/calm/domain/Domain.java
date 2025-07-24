package org.finos.calm.domain;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import static org.finos.calm.resources.ResourceValidationConstants.DOMAIN_NAME_MESSAGE;
import static org.finos.calm.resources.ResourceValidationConstants.DOMAIN_NAME_REGEX;

/**
 * Represents a domain in the CALM system.
 * A domain is a logical grouping of controls and shared control schemas
 */
public class  Domain {

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

    @Pattern(regexp = DOMAIN_NAME_REGEX, message = DOMAIN_NAME_MESSAGE)
    @NotBlank(message = "domain name must not be blank")
    @NotNull(message = "domain name must not be null")
    private String name;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }
}
