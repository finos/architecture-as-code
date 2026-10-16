package org.finos.calm.store.github;

import org.finos.calm.domain.exception.GitHubWriteNotSupportedException;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.finos.calm.domain.exception.NamespaceAlreadyExistsException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceInfo;
import org.finos.calm.store.NamespaceStore;
import org.finos.calm.store.github.registry.ResourceRegistry;

import java.util.List;

/**
 * GitHub-mode {@link NamespaceStore}. Namespaces are not a resource stored in any repo - they
 * are the deployment-level mapping of {@code calm.github.namespaces[*]} entries to cloned
 * repos, already materialised into {@link ResourceRegistry}'s snapshot by
 * {@link org.finos.calm.store.github.sync.GitHubStartupInitializer} at boot. This store is
 * therefore a thin read view over that snapshot, never a writer of it: creating or deleting a
 * namespace here would mean editing the running deployment's configuration, which is exactly
 * what {@link GitHubWriteNotSupportedException} exists to point the caller at instead.
 */
@ApplicationScoped
@Typed(GitHubNamespaceStore.class)
public class GitHubNamespaceStore implements NamespaceStore {

    private static final String UNSUPPORTED_MSG =
            "Namespaces in GitHub mode are admin-configured via deployment properties (calm.github.namespaces[*]). " +
            "Update your deployment configuration to add or remove namespaces.";

    private final ResourceRegistry registryService;

    @Inject
    public GitHubNamespaceStore(ResourceRegistry registryService) {
        this.registryService = registryService;
    }

    @Override
    public List<NamespaceInfo> getNamespaces() {
        return registryService.getSnapshot().getNamespaces().stream()
                .map(name -> new NamespaceInfo(name, ""))
                .toList();
    }

    @Override
    public boolean namespaceExists(String namespaceName) {
        return registryService.getSnapshot().getNamespaces().contains(namespaceName);
    }

    @Override
    public void createNamespace(String name, String description) throws NamespaceAlreadyExistsException {
        throw new GitHubWriteNotSupportedException(UNSUPPORTED_MSG);
    }

    @Override
    public void updateNamespaceDescription(String name, String description) throws NamespaceNotFoundException {
        throw new GitHubWriteNotSupportedException(UNSUPPORTED_MSG);
    }

    @Override
    public void deleteNamespace(String name) throws NamespaceNotFoundException {
        throw new GitHubWriteNotSupportedException(UNSUPPORTED_MSG);
    }
}
