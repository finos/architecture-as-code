package org.finos.calm.store.github;

import org.finos.calm.domain.exception.GitHubWriteNotSupportedException;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.finos.calm.domain.CalmInterface;
import org.finos.calm.domain.exception.InterfaceNotFoundException;
import org.finos.calm.domain.exception.InterfaceVersionExistsException;
import org.finos.calm.domain.exception.InterfaceVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.interfaces.CreateInterfaceRequest;
import org.finos.calm.domain.interfaces.NamespaceInterfaceSummary;
import org.finos.calm.store.InterfaceStore;
import org.finos.calm.store.github.util.InMemoryRegistryService;

import java.util.Collections;
import java.util.List;

@ApplicationScoped
@Typed(GitHubInterfaceStore.class)
public class GitHubInterfaceStore implements InterfaceStore {

    private static final String WRITE_UNSUPPORTED =
            "Write operations are not yet available. GitHub account linking and PR creation will be enabled in a future release.";

    private static final String VERSION_UNSUPPORTED =
            "Version history via GitHub API is not yet implemented.";

    private final InMemoryRegistryService registryService;

    @Inject
    public GitHubInterfaceStore(InMemoryRegistryService registryService) {
        this.registryService = registryService;
    }

    @Override
    public List<NamespaceInterfaceSummary> getInterfacesForNamespace(String namespace) throws NamespaceNotFoundException {
        verifyNamespace(namespace);
        return Collections.emptyList();
    }

    @Override
    public CalmInterface createInterfaceForNamespace(CreateInterfaceRequest interfaceRequest, String namespace) throws NamespaceNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public List<String> getInterfaceVersions(String namespace, Integer interfaceId) throws NamespaceNotFoundException, InterfaceNotFoundException {
        throw new GitHubWriteNotSupportedException(VERSION_UNSUPPORTED);
    }

    @Override
    public String getInterfaceForVersion(String namespace, Integer interfaceId, String version) throws NamespaceNotFoundException, InterfaceNotFoundException, InterfaceVersionNotFoundException {
        throw new GitHubWriteNotSupportedException(VERSION_UNSUPPORTED);
    }

    @Override
    public CalmInterface createInterfaceForVersion(CreateInterfaceRequest interfaceRequest, String namespace, Integer interfaceId, String version) throws NamespaceNotFoundException, InterfaceNotFoundException, InterfaceVersionExistsException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    private void verifyNamespace(String namespace) throws NamespaceNotFoundException {
        if (!registryService.getSnapshot().getNamespaces().contains(namespace)) {
            throw new NamespaceNotFoundException();
        }
    }
}
