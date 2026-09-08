package org.finos.calm.store.github;

import org.finos.calm.domain.exception.GitHubWriteNotSupportedException;

import io.quarkus.security.identity.SecurityIdentity;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.UserAccessNotFoundException;
import org.finos.calm.security.OidcRoleResolver;
import org.finos.calm.store.UserAccessStore;
import org.finos.calm.store.github.util.GitHubCloneManager;
import org.finos.calm.store.github.util.InMemoryRegistryService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * In GitHub mode, access is derived from OIDC token roles/claims.
 * The user's OIDC token is inspected for configured role values that map to
 * READ or WRITE permissions on all cloned namespaces.
 */
@ApplicationScoped
@Typed(GitHubUserAccessStore.class)
public class GitHubUserAccessStore implements UserAccessStore {

    private static final Logger LOG = LoggerFactory.getLogger(GitHubUserAccessStore.class);

    private static final String ADMIN_UNSUPPORTED =
            "Access in GitHub mode is derived from OIDC roles. Configure IdP group assignments to manage access.";
    private static final String WRITE_UNSUPPORTED =
            "Access grants cannot be created in GitHub mode. Assign users to the appropriate IdP roles instead.";

    @Inject
    InMemoryRegistryService registryService;

    @Inject
    OidcRoleResolver roleResolver;

    @Inject
    SecurityIdentity identity;

    @Inject
    GitHubCloneManager cloneManager;

    @Override
    public List<UserAccess> getGrantsForUser(String username) {
        List<UserAccess> grants = new ArrayList<>();
        List<String> namespaces = registryService.getSnapshot().getNamespaces();

        if (namespaces.isEmpty()) {
            return grants;
        }

        for (String namespace : namespaces) {
            Set<String> accessGroups = cloneManager != null ? cloneManager.getAccessGroupsForNamespace(namespace) : Set.of();

            OidcRoleResolver.AccessLevel level = roleResolver.resolve(identity, accessGroups);

            if (level != OidcRoleResolver.AccessLevel.NONE) {
                grants.add(new UserAccess(username, UserAccess.Permission.read, namespace));
            } else {
                LOG.debug("User [{}] denied access to namespace [{}] — no matching group", username, namespace);
            }
        }
        return grants;
    }

    @Override
    public List<UserAccess> getUserAccessForUsername(String username) throws UserAccessNotFoundException {
        List<UserAccess> grants = getGrantsForUser(username);
        if (grants.isEmpty()) {
            throw new UserAccessNotFoundException();
        }
        return grants;
    }

    @Override
    public List<UserAccess> getUserAccessForNamespace(String namespace) throws NamespaceNotFoundException {
        throw new GitHubWriteNotSupportedException(ADMIN_UNSUPPORTED);
    }

    @Override
    public UserAccess getUserAccessForNamespaceAndId(String namespace, Integer userAccessId) throws NamespaceNotFoundException, UserAccessNotFoundException {
        throw new GitHubWriteNotSupportedException(ADMIN_UNSUPPORTED);
    }

    @Override
    public List<UserAccess> getUserAccessForDomain(String domain) {
        throw new GitHubWriteNotSupportedException(ADMIN_UNSUPPORTED);
    }

    @Override
    public UserAccess getUserAccessForDomainAndId(String domain, Integer userAccessId) throws UserAccessNotFoundException {
        throw new GitHubWriteNotSupportedException(ADMIN_UNSUPPORTED);
    }

    @Override
    public UserAccess createUserAccessForNamespace(UserAccess userAccess) throws NamespaceNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public UserAccess createUserAccessForDomain(UserAccess userAccess) {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public void deleteUserAccessForNamespace(String namespace, Integer userAccessId) throws NamespaceNotFoundException, UserAccessNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public void deleteUserAccessForDomain(String domain, Integer userAccessId) throws UserAccessNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public void deleteAllUserAccessForNamespace(String namespace) {
        // no-op
    }

    @Override
    public void deleteAllUserAccessForDomain(String domain) {
        // no-op
    }
}
