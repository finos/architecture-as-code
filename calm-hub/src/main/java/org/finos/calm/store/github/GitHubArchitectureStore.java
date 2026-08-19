package org.finos.calm.store.github;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.finos.calm.domain.exception.GitHubWriteNotSupportedException;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.domain.Architecture;
import org.finos.calm.domain.exception.ArchitectureNotFoundException;
import org.finos.calm.domain.exception.ArchitectureVersionExistsException;
import org.finos.calm.domain.exception.ArchitectureVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.store.ArchitectureStore;
import org.finos.calm.store.PageRequest;
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
@Typed(GitHubArchitectureStore.class)
public class GitHubArchitectureStore implements ArchitectureStore {

    private static final String WRITE_UNSUPPORTED =
            "Write operations are not yet available. GitHub account linking and PR creation will be enabled in a future release.";

    private static final Logger LOG = LoggerFactory.getLogger(GitHubArchitectureStore.class);

    private final InMemoryRegistryService registryService;

    @Inject
    @ConfigProperty(name = "calm.github.clone-directory", defaultValue = "/tmp/calm-hub-clones")
    String cloneDirectory;

    @Inject
    GitHubCloneManager cloneManager;

    @Inject
    GitHubVersionService versionService;

    @Inject
    public GitHubArchitectureStore(InMemoryRegistryService registryService) {
        this.registryService = registryService;
    }

    @Override
    public List<NamespaceResourceSummary> getArchitecturesForNamespace(String namespace, PageRequest page) throws NamespaceNotFoundException {
        verifyNamespace(namespace);
        List<RegistryEntry> entries = registryService.listByType(namespace, CalmResourceType.ARCHITECTURE);
        String repo = cloneManager != null ? cloneManager.getRepoForNamespace(namespace) : null;
        return entries.parallelStream()
                .map(e -> {
                    int versionCount = 0;
                    if (repo != null && versionService != null) {
                        versionCount = versionService.getFileVersions(repo, e.filePath().toString()).size();
                    }
                    return new NamespaceResourceSummary(e.name(), e.uniqueId(), (e.uniqueId().hashCode() & 0x7FFFFFFF), versionCount);
                })
                .toList();
    }

    @Override
    public Architecture createArchitectureForNamespace(Architecture architecture) throws NamespaceNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public List<String> getArchitectureVersions(Architecture architecture) throws NamespaceNotFoundException, ArchitectureNotFoundException {
        verifyNamespace(architecture.getNamespace());
        RegistryEntry entry = findEntryById(architecture.getNamespace(), architecture.getId());
        String repo = cloneManager != null ? cloneManager.getRepoForNamespace(architecture.getNamespace()) : null;
        if (repo != null && versionService != null) {
            return versionService.getFileVersions(repo, entry.filePath().toString());
        }
        return List.of("latest");
    }

    @Override
    public String getArchitectureForVersion(Architecture architecture) throws NamespaceNotFoundException, ArchitectureNotFoundException, ArchitectureVersionNotFoundException {
        verifyNamespace(architecture.getNamespace());
        RegistryEntry entry = findEntryById(architecture.getNamespace(), architecture.getId());
        String version = architecture.getDotVersion();

        // If a specific SHA is requested and version service is available, fetch from GitHub API
        if (version != null && !version.equals("latest") && version.matches("[0-9a-f]{7,40}")
                && cloneManager != null && versionService != null) {
            String repo = cloneManager.getRepoForNamespace(architecture.getNamespace());
            if (repo != null) {
                String content = versionService.getFileAtVersion(repo, entry.filePath().toString(), version);
                if (content != null) {
                    return content;
                }
            }
        }

        // Fallback: read from local clone (latest/HEAD)
        try {
            Path filePath = Path.of(cloneDirectory, architecture.getNamespace()).resolve(entry.filePath());
            return Files.readString(filePath);
        } catch (IOException e) {
            LOG.error("Failed to read architecture file: {}", entry.filePath(), e);
            throw new ArchitectureVersionNotFoundException();
        }
    }

    @Override
    public Architecture createArchitectureForVersion(Architecture architecture) throws NamespaceNotFoundException, ArchitectureNotFoundException, ArchitectureVersionExistsException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public Architecture updateArchitectureForVersion(Architecture architecture) throws NamespaceNotFoundException, ArchitectureNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    private RegistryEntry findEntryById(String namespace, int id) throws ArchitectureNotFoundException {
        List<RegistryEntry> entries = registryService.listByType(namespace, CalmResourceType.ARCHITECTURE);
        Optional<RegistryEntry> found = entries.stream()
                .filter(e -> (e.uniqueId().hashCode() & 0x7FFFFFFF) == id)
                .findFirst();
        if (found.isEmpty()) {
            throw new ArchitectureNotFoundException();
        }
        return found.get();
    }

    private void verifyNamespace(String namespace) throws NamespaceNotFoundException {
        if (!registryService.getSnapshot().getNamespaces().contains(namespace)) {
            throw new NamespaceNotFoundException();
        }
    }
}
