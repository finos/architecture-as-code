package org.finos.calm.store;

import org.finos.calm.domain.UserAccess;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.UserAccessNotFoundException;

import java.util.List;

/**
 * Interface for managing user-access grants in the CALM system.
 * Provides methods to retrieve and create user permissions through admin APIs.
 */
public interface UserAccessStore {

    /**
     * Store a new UserAccess with the specified userAccess details.
     *
     * @param userAccess the UserAccess details to create.
     * @return the created UserAccess object.
     * @throws NamespaceNotFoundException if UserAccess request contains an invalid namespace name.
     */
    UserAccess createUserAccessForNamespace(UserAccess userAccess) throws NamespaceNotFoundException;

    /**
     * Retrieves a list of all UserAccess details mapped to username.
     *
     * @param username the name of the user to fetch UserAccess records.
     * @return a list of UserAccess details
     */
    List<UserAccess> getUserAccessForUsername(String username) throws UserAccessNotFoundException;

    /**
     * Retrieves a list of all UserAccess details associated to a namespace.
     *
     * @param namespace the name of the namespace to fetch associated UserAccess records.
     * @return a list of UserAccess details
     */
    List<UserAccess> getUserAccessForNamespace(String namespace) throws NamespaceNotFoundException, UserAccessNotFoundException;

    /**
     * Retrieve a UserAccess object that is mapped to a namespace and userAccessId.
     *
     * @param namespace    the name of the namespace to fetch associated UserAccess records.
     * @param userAccessId the sequence number of a UserAccess record.
     * @return a list of UserAccess details
     */
    UserAccess getUserAccessForNamespaceAndId(String namespace, Integer userAccessId) throws NamespaceNotFoundException, UserAccessNotFoundException;
}
