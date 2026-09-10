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
import org.finos.calm.store.github.registry.RegistryResourceType;
import org.finos.calm.store.github.sync.GitHubCloneManager;
import org.finos.calm.store.github.access.NamespaceFileReader;
import org.finos.calm.store.github.api.GitHubFileHistoryClient;
import org.finos.calm.store.github.registry.ResourceRegistry;
import org.finos.calm.store.github.registry.RegistryEntry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.List;

@ApplicationScoped
@Typed(GitHubInterfaceStore.class)
public class GitHubInterfaceStore extends AbstractReadOnlyGitHubStore implements InterfaceStore {

    private static final Logger LOG = LoggerFactory.getLogger(GitHubInterfaceStore.class);

    @Inject
    public GitHubInterfaceStore(ResourceRegistry registryService, GitHubCloneManager cloneManager,
                                 GitHubFileHistoryClient versionService, NamespaceFileReader fileReader) {
        super(registryService, cloneManager, versionService, fileReader);
    }

    @Override
    public List<NamespaceInterfaceSummary> getInterfacesForNamespace(String namespace) throws NamespaceNotFoundException {
        verifyNamespace(namespace);
        List<RegistryEntry> entries = registryService.listByType(namespace, RegistryResourceType.INTERFACE);
        return entries.stream()
                .map(e -> new NamespaceInterfaceSummary(e.name(), e.uniqueId(), (e.uniqueId().hashCode() & 0x7FFFFFFF)))
                .toList();
    }

    @Override
    public CalmInterface createInterfaceForNamespace(CreateInterfaceRequest interfaceRequest, String namespace) throws NamespaceNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public List<String> getInterfaceVersions(String namespace, Integer interfaceId) throws NamespaceNotFoundException, InterfaceNotFoundException {
        verifyNamespace(namespace);
        RegistryEntry entry = findEntry(namespace, RegistryResourceType.INTERFACE, interfaceId)
                .orElseThrow(InterfaceNotFoundException::new);
        return getVersions(namespace, entry);
    }

    @Override
    public String getInterfaceForVersion(String namespace, Integer interfaceId, String version) throws NamespaceNotFoundException, InterfaceNotFoundException, InterfaceVersionNotFoundException {
        verifyNamespace(namespace);
        RegistryEntry entry = findEntry(namespace, RegistryResourceType.INTERFACE, interfaceId)
                .orElseThrow(InterfaceNotFoundException::new);
        try {
            return readAtVersion(namespace, entry, version)
                    .orElseThrow(InterfaceVersionNotFoundException::new);
        } catch (IOException e) {
            LOG.error("Failed to read interface file: {}", entry.filePath(), e);
            throw new InterfaceVersionNotFoundException();
        }
    }

    @Override
    public CalmInterface createInterfaceForVersion(CreateInterfaceRequest interfaceRequest, String namespace, Integer interfaceId, String version) throws NamespaceNotFoundException, InterfaceNotFoundException, InterfaceVersionExistsException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public void deleteInterface(String namespace, Integer interfaceId) throws NamespaceNotFoundException, InterfaceNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }
}
