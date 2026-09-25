package org.finos.calm.store.github;

import org.finos.calm.domain.exception.GitHubWriteNotSupportedException;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.finos.calm.domain.BuildingBlock;
import org.finos.calm.domain.buildingblocks.CreateBuildingBlockRequest;
import org.finos.calm.domain.exception.BuildingBlockNotFoundException;
import org.finos.calm.domain.exception.BuildingBlockVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.store.BuildingBlockStore;
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

/**
 * GitHub-mode {@link BuildingBlockStore}: building blocks are read from files under
 * {@code building-blocks/} in the namespace's clone, classified into the registry as their
 * own {@link RegistryResourceType#BUILDING_BLOCK} type - restored per PR #3066 review
 * discussion (byrash, 2026-09-24) after the 2026-09-10 Office Hours decision (#3052) had
 * aliased this directory to {@code Standard}. Naming and any broader node-catalogue scope
 * (#3102) are still pending a follow-up alignment call; this restores exactly the prior
 * scope - GitHub-mode listing, version listing, and version-content resolution only. Id
 * lookup, version listing and version-content resolution all delegate to
 * {@link AbstractReadOnlyGitHubStore} - see its class javadoc for why an unresolvable version
 * 404s rather than silently reading whatever HEAD holds. Every mutating method throws
 * {@link GitHubWriteNotSupportedException}: this backend is read-only until GitHub account
 * linking and PR creation land.
 */
@ApplicationScoped
@Typed(GitHubBuildingBlockStore.class)
public class GitHubBuildingBlockStore extends AbstractReadOnlyGitHubStore implements BuildingBlockStore {

    private static final Logger LOG = LoggerFactory.getLogger(GitHubBuildingBlockStore.class);

    @Inject
    public GitHubBuildingBlockStore(ResourceRegistry registryService, GitHubCloneManager cloneManager,
                                     GitHubFileHistoryClient versionService, NamespaceFileReader fileReader) {
        super(registryService, cloneManager, versionService, fileReader);
    }

    @Override
    public List<NamespaceResourceSummary> getBuildingBlocksForNamespace(String namespace) throws NamespaceNotFoundException {
        verifyNamespace(namespace);
        List<RegistryEntry> entries = registryService.listByType(namespace, RegistryResourceType.BUILDING_BLOCK);
        return entries.stream()
                .map(e -> new NamespaceResourceSummary(e.name(), null, (e.uniqueId().hashCode() & 0x7FFFFFFF), 0))
                .toList();
    }

    @Override
    public BuildingBlock createBuildingBlockForNamespace(CreateBuildingBlockRequest buildingBlockRequest, String namespace) throws NamespaceNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public List<String> getBuildingBlockVersions(String namespace, Integer buildingBlockId) throws NamespaceNotFoundException, BuildingBlockNotFoundException {
        verifyNamespace(namespace);
        RegistryEntry entry = findEntry(namespace, RegistryResourceType.BUILDING_BLOCK, buildingBlockId)
                .orElseThrow(BuildingBlockNotFoundException::new);
        return getVersions(namespace, entry);
    }

    @Override
    public String getBuildingBlockForVersion(String namespace, Integer buildingBlockId, String version) throws NamespaceNotFoundException, BuildingBlockNotFoundException, BuildingBlockVersionNotFoundException {
        verifyNamespace(namespace);
        RegistryEntry entry = findEntry(namespace, RegistryResourceType.BUILDING_BLOCK, buildingBlockId)
                .orElseThrow(BuildingBlockNotFoundException::new);
        try {
            return readAtVersion(namespace, entry, version)
                    .orElseThrow(BuildingBlockVersionNotFoundException::new);
        } catch (IOException e) {
            LOG.error("Failed to read building block file: {}", entry.filePath(), e);
            throw new BuildingBlockVersionNotFoundException();
        }
    }

    @Override
    public BuildingBlock createBuildingBlockForVersion(CreateBuildingBlockRequest buildingBlockRequest, String namespace, Integer buildingBlockId, String version) throws NamespaceNotFoundException, BuildingBlockNotFoundException, BuildingBlockVersionNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }
}
