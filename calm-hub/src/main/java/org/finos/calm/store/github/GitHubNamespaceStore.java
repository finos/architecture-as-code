package org.finos.calm.store.github;

import org.finos.calm.domain.exception.GitHubWriteNotSupportedException;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.finos.calm.domain.exception.NamespaceAlreadyExistsException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceInfo;
import org.finos.calm.store.NamespaceStore;
import org.finos.calm.store.github.util.InMemoryRegistryService;

import java.util.List;

@ApplicationScoped
@Typed(GitHubNamespaceStore.class)
public class GitHubNamespaceStore implements NamespaceStore {

    private static final String UNSUPPORTED_MSG =
            "Namespaces in GitHub mode are admin-configured via deployment properties (calm.github.namespaces[*]). " +
            "Update your deployment configuration to add or remove namespaces.";

    private final InMemoryRegistryService registryService;

    @Inject
    public GitHubNamespaceStore(InMemoryRegistryService registryService) {
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
