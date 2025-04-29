package org.finos.calm.store;

import org.finos.calm.domain.Domain;
import org.finos.calm.domain.exception.DomainAlreadyExistsException;

import java.util.List;

/**
 * Interface for managing domains in the CALM system.
 * Provides methods to retrieve and create domains.
 */
public interface DomainStore {
    /**
     * Retrieves a list of all domains in the system.
     *
     * @return a list of domain names
     */
    List<String> getDomains();

    /**
     * Creates a new domain with the specified name.
     *
     * @param name the name of the domain to create
     * @return the created Domain object
     * @throws DomainAlreadyExistsException if a domain with the same name already exists
     */
    Domain createDomain(String name) throws DomainAlreadyExistsException;
}
