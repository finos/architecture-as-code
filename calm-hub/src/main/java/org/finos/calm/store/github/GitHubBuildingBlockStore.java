package org.finos.calm.store.github;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.domain.exception.BuildingBlockNotFoundException;
import org.finos.calm.domain.exception.BuildingBlockVersionNotFoundException;
import org.finos.calm.domain.exception.GitHubWriteNotSupportedException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.store.BuildingBlockStore;
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
@Typed(GitHubBuildingBlockStore.class)
public class GitHubBuildingBlockStore implements BuildingBlockStore {

    private static final String WRITE_UNSUPPORTED =
            "Write operations are not yet available. GitHub account linking and PR creation will be enabled in a future release.";

    private static final Logger LOG = LoggerFactory.getLogger(GitHubBuildingBlockStore.class);

    private final InMemoryRegistryService registryService;

    @Inject
    @ConfigProperty(name = "calm.github.clone-directory", defaultValue = "/tmp/calm-hub-clones")
    String cloneDirectory;

    @Inject
    GitHubCloneManager cloneManager;

    @Inject
    GitHubVersionService versionService;

    @Inject
    public GitHubBuildingBlockStore(InMemoryRegistryService registryService) {
        this.registryService = registryService;
    }

    @Override
    public List<NamespaceResourceSummary> getBuildingBlocksForNamespace(String namespace) throws NamespaceNotFoundException {
        verifyNamespace(namespace);
        List<RegistryEntry> entries = registryService.listByType(namespace, CalmResourceType.BUILDING_BLOCK);
        String repo = cloneManager != null ? cloneManager.getRepoForNamespace(namespace) : null;
        return entries.stream()
                .map(e -> {
                    
                    if (repo != null && versionService != null) {
                    }
                    return new NamespaceResourceSummary(e.name(), e.uniqueId(), (e.uniqueId().hashCode() & 0x7FFFFFFF), 0);
                })
                .toList();
    }

    @Override
    public int createBuildingBlockForNamespace(String namespace, String buildingBlockJson) throws NamespaceNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public List<String> getBuildingBlockVersions(String namespace, int buildingBlockId) throws NamespaceNotFoundException, BuildingBlockNotFoundException {
        verifyNamespace(namespace);
        RegistryEntry entry = findEntryById(namespace, buildingBlockId);
        String repo = cloneManager != null ? cloneManager.getRepoForNamespace(namespace) : null;
        if (repo != null && versionService != null) {
            return versionService.getFileVersions(repo, entry.filePath().toString());
        }
        return List.of("latest");
    }

    @Override
    public String getBuildingBlockForVersion(String namespace, int buildingBlockId, String version) throws NamespaceNotFoundException, BuildingBlockNotFoundException, BuildingBlockVersionNotFoundException {
        verifyNamespace(namespace);
        RegistryEntry entry = findEntryById(namespace, buildingBlockId);

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
            LOG.error("Failed to read building block file: {}", entry.filePath(), e);
            throw new BuildingBlockVersionNotFoundException();
        }
    }

    @Override
    public void createBuildingBlockForVersion(String namespace, int buildingBlockId, String version, String buildingBlockJson) throws NamespaceNotFoundException, BuildingBlockNotFoundException, BuildingBlockVersionNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    private RegistryEntry findEntryById(String namespace, int id) throws BuildingBlockNotFoundException {
        List<RegistryEntry> entries = registryService.listByType(namespace, CalmResourceType.BUILDING_BLOCK);
        Optional<RegistryEntry> found = entries.stream()
                .filter(e -> (e.uniqueId().hashCode() & 0x7FFFFFFF) == id)
                .findFirst();
        if (found.isEmpty()) {
            throw new BuildingBlockNotFoundException();
        }
        return found.get();
    }

    private void verifyNamespace(String namespace) throws NamespaceNotFoundException {
        if (!registryService.getSnapshot().getNamespaces().contains(namespace)) {
            throw new NamespaceNotFoundException();
        }
    }
}
