package org.finos.calm.store;

import org.finos.calm.domain.UserAccess;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.UserAccessNotFoundException;

import java.util.Collection;
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
     * Group grants are excluded.
     * Used by the permission checker so both are resolved in a single store round-trip.
     *
     * @param username the authenticated user's name.
     * @return a list of UserAccess details (may be empty, never throws UserAccessNotFoundException).
     */
    List<UserAccess> getGrantsForUser(String username);

    /**
     * Retrieves the group grants on any of the given namespaces.
     *
     * @param namespaces the namespaces to match, e.g. a namespace and its ancestors.
     * @return the group grants (empty if none exist, or if the store does not support group grants).
     */
    default List<UserAccess> getGroupGrantsForNamespaces(Collection<String> namespaces) {
        return List.of();
    }

    /**
     * Retrieves the group grants on a domain.
     *
     * @param domain the domain name.
     * @return the group grants (empty if none exist, or if the store does not support group grants).
     */
    default List<UserAccess> getGroupGrantsForDomain(String domain) {
        return List.of();
    }

    /**
     * Retrieves every group grant, for callers that resolve access across all namespaces
     * and domains at once, such as search.
     *
     * @return the group grants (empty if none exist, or if the store does not support group grants).
     */
    default List<UserAccess> getAllGroupGrants() {
        return List.of();
    }

    /**
     * Retrieves a list of all UserAccess details associated to a namespace.
     *
     * @param namespace the name of the namespace to fetch associated UserAccess records.
     * @return a list of UserAccess details (empty if none exist)
     */
    List<UserAccess> getUserAccessForNamespace(String namespace) throws NamespaceNotFoundException;

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
     * @return a list of UserAccess details (empty if none exist)
     */
    List<UserAccess> getUserAccessForDomain(String domain);

    /**
     * Retrieve a specific domain-scoped UserAccess record by domain and id.
     *
     * @param domain       the domain name.
     * @param userAccessId the sequence number of a UserAccess record.
     * @return the UserAccess record
     */
    UserAccess getUserAccessForDomainAndId(String domain, Integer userAccessId) throws UserAccessNotFoundException;

    /**
     * Delete a namespace-scoped UserAccess grant by namespace and id.
     *
     * @param namespace    the namespace the grant belongs to.
     * @param userAccessId the sequence number of the UserAccess record to delete.
     * @throws NamespaceNotFoundException  if the namespace does not exist.
     * @throws UserAccessNotFoundException if no grant exists for that id in the namespace.
     */
    void deleteUserAccessForNamespace(String namespace, Integer userAccessId) throws NamespaceNotFoundException, UserAccessNotFoundException;

    /**
     * Deletes every UserAccess grant scoped to a namespace, e.g. as part of deleting the
     * namespace itself. Idempotent — deleting zero grants is not an error.
     *
     * @param namespace the namespace whose grants should all be removed.
     */
    void deleteAllUserAccessForNamespace(String namespace);

    /**
     * Delete a domain-scoped UserAccess grant by domain and id.
     *
     * @param domain       the domain the grant belongs to.
     * @param userAccessId the sequence number of the UserAccess record to delete.
     * @throws UserAccessNotFoundException if no grant exists for that id in the domain.
     */
    void deleteUserAccessForDomain(String domain, Integer userAccessId) throws UserAccessNotFoundException;

    /**
     * Deletes every UserAccess grant scoped to a domain, e.g. as part of deleting the
     * domain itself. Idempotent — deleting zero grants is not an error.
     *
     * @param domain the domain whose grants should all be removed.
     */
    void deleteAllUserAccessForDomain(String domain);
}
