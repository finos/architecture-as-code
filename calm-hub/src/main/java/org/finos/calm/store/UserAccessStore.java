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
     * Retrieves all grants applicable to a user: their own grants plus any {@code *} (public) grants.
     * Used by the permission checker so both are resolved in a single store round-trip.
     *
     * @param username the authenticated user's name.
     * @return a list of UserAccess details (may be empty, never throws UserAccessNotFoundException).
     */
    List<UserAccess> getGrantsForUser(String username);

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

    /**
     * Store a new domain-scoped UserAccess grant.
     *
     * @param userAccess the UserAccess details to create.
     * @return the created UserAccess object.
     */
    UserAccess createUserAccessForDomain(UserAccess userAccess);

    /**
     * Retrieves all UserAccess grants for a given domain.
     *
     * @param domain the domain name to fetch associated UserAccess records.
     * @return a list of UserAccess details
     */
    List<UserAccess> getUserAccessForDomain(String domain) throws UserAccessNotFoundException;

    /**
     * Retrieve a specific domain-scoped UserAccess record by domain and id.
     *
     * @param domain       the domain name.
     * @param userAccessId the sequence number of a UserAccess record.
     * @return the UserAccess record
     */
    UserAccess getUserAccessForDomainAndId(String domain, Integer userAccessId) throws UserAccessNotFoundException;
}
