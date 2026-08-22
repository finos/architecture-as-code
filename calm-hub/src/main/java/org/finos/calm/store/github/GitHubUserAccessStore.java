package org.finos.calm.store.github;

import org.finos.calm.domain.exception.GitHubWriteNotSupportedException;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.UserAccessNotFoundException;
import org.finos.calm.security.GitHubRequestContext;
import org.finos.calm.store.UserAccessStore;
import org.finos.calm.store.github.util.InMemoryRegistryService;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * In GitHub mode, access is granted to all cloned namespaces when the user has linked their GitHub account.
 * If not linked, no access is granted — GitHub linking is mandatory.
 */
@ApplicationScoped
@Typed(GitHubUserAccessStore.class)
public class GitHubUserAccessStore implements UserAccessStore {

    private static final String ADMIN_UNSUPPORTED =
            "Access in GitHub mode is derived from repository permissions. Use GitHub settings to manage access.";
    private static final String WRITE_UNSUPPORTED =
            "Access grants cannot be created in GitHub mode. Assign users to IdP groups and grant GitHub repo access instead.";

    @Inject
    InMemoryRegistryService registryService;

    @Inject
    GitHubRequestContext githubContext;

    @Override
    public List<UserAccess> getGrantsForUser(String username) {
        List<UserAccess> grants = new ArrayList<>();
        List<String> namespaces = registryService.getSnapshot().getNamespaces();

        Optional<String> ghToken = githubContext != null ? githubContext.getToken() : Optional.empty();

        if (ghToken.isEmpty()) {
            return grants;
        }

        // User linked — grant write to all namespaces the service token can reach.
        // The service token already proved access by cloning these repos.
        for (String namespace : namespaces) {
            grants.add(new UserAccess(username, UserAccess.Permission.write, namespace));
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
        // no-op — nothing to delete in GitHub mode
    }

    @Override
    public void deleteAllUserAccessForDomain(String domain) {
        // no-op — nothing to delete in GitHub mode
    }
}
