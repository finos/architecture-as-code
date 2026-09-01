package org.finos.calm.store.github;

import org.finos.calm.domain.exception.GitHubWriteNotSupportedException;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.domain.CalmInterface;
import org.finos.calm.domain.exception.InterfaceNotFoundException;
import org.finos.calm.domain.exception.InterfaceVersionExistsException;
import org.finos.calm.domain.exception.InterfaceVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.interfaces.CreateInterfaceRequest;
import org.finos.calm.domain.interfaces.NamespaceInterfaceSummary;
import org.finos.calm.store.InterfaceStore;
import org.finos.calm.store.github.util.CalmResourceType;
import org.finos.calm.store.github.util.GitHubCloneManager;
import org.finos.calm.store.github.util.GitHubVersionService;
import org.finos.calm.store.github.util.InMemoryRegistryService;
import org.finos.calm.store.github.util.RegistryEntry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;

@ApplicationScoped
@Typed(GitHubInterfaceStore.class)
public class GitHubInterfaceStore implements InterfaceStore {

    private static final String WRITE_UNSUPPORTED =
            "Write operations are not yet available. GitHub account linking and PR creation will be enabled in a future release.";

    private static final Logger LOG = LoggerFactory.getLogger(GitHubInterfaceStore.class);

    private final InMemoryRegistryService registryService;

    @Inject
    @ConfigProperty(name = "calm.github.clone-directory", defaultValue = "/tmp/calm-hub-clones")
    String cloneDirectory;

    @Inject
    GitHubCloneManager cloneManager;

    @Inject
    GitHubVersionService versionService;

    @Inject
    public GitHubInterfaceStore(InMemoryRegistryService registryService) {
        this.registryService = registryService;
    }

    @Override
    public List<NamespaceInterfaceSummary> getInterfacesForNamespace(String namespace) throws NamespaceNotFoundException {
        verifyNamespace(namespace);
        List<RegistryEntry> entries = registryService.listByType(namespace, CalmResourceType.INTERFACE);
        String repo = cloneManager != null ? cloneManager.getRepoForNamespace(namespace) : null;
        return entries.stream()
                .map(e -> {
                    
                    if (repo != null && versionService != null) {
                    }
                    return new NamespaceInterfaceSummary(e.name(), e.uniqueId(), (e.uniqueId().hashCode() & 0x7FFFFFFF));
                })
                .toList();
    }

    @Override
    public CalmInterface createInterfaceForNamespace(CreateInterfaceRequest interfaceRequest, String namespace) throws NamespaceNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public List<String> getInterfaceVersions(String namespace, Integer interfaceId) throws NamespaceNotFoundException, InterfaceNotFoundException {
        verifyNamespace(namespace);
        RegistryEntry entry = findEntryById(namespace, interfaceId);
        String repo = cloneManager != null ? cloneManager.getRepoForNamespace(namespace) : null;
        if (repo != null && versionService != null) {
            return versionService.getFileVersions(repo, entry.filePath().toString());
        }
        return List.of("latest");
    }

    @Override
    public String getInterfaceForVersion(String namespace, Integer interfaceId, String version) throws NamespaceNotFoundException, InterfaceNotFoundException, InterfaceVersionNotFoundException {
        verifyNamespace(namespace);
        RegistryEntry entry = findEntryById(namespace, interfaceId);

        // If a specific SHA is requested and version service is available, fetch from GitHub API
        if (version != null && !version.equals("latest") && version.matches("[0-9a-f]{7,40}")
                && cloneManager != null && versionService != null) {
            String repo = cloneManager.getRepoForNamespace(namespace);
            if (repo != null) {
                String content = versionService.getFileAtVersion(repo, entry.filePath().toString(), version);
                if (content != null) {
                    return content;
                }
            }
        }

        // Fallback: read from local clone (latest/HEAD)
        try {
            Path filePath = Path.of(cloneDirectory, namespace).resolve(entry.filePath());
            return Files.readString(filePath);
        } catch (IOException e) {
            LOG.error("Failed to read interface file: {}", entry.filePath(), e);
            throw new InterfaceVersionNotFoundException();
        }
    }

    @Override
    public CalmInterface createInterfaceForVersion(CreateInterfaceRequest interfaceRequest, String namespace, Integer interfaceId, String version) throws NamespaceNotFoundException, InterfaceNotFoundException, InterfaceVersionExistsException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    private RegistryEntry findEntryById(String namespace, int id) throws InterfaceNotFoundException {
        List<RegistryEntry> entries = registryService.listByType(namespace, CalmResourceType.INTERFACE);
        Optional<RegistryEntry> found = entries.stream()
                .filter(e -> (e.uniqueId().hashCode() & 0x7FFFFFFF) == id)
                .findFirst();
        if (found.isEmpty()) {
            throw new InterfaceNotFoundException();
        }
        return found.get();
    }

    private void verifyNamespace(String namespace) throws NamespaceNotFoundException {
        if (!registryService.getSnapshot().getNamespaces().contains(namespace)) {
            throw new NamespaceNotFoundException();
        }
    }
}
