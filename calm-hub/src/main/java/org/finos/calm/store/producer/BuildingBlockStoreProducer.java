package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.config.DatabaseMode;
import org.finos.calm.domain.BuildingBlock;
import org.finos.calm.domain.buildingblocks.CreateBuildingBlockRequest;
import org.finos.calm.domain.exception.BuildingBlockNotFoundException;
import org.finos.calm.domain.exception.BuildingBlockVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.store.BuildingBlockStore;
import org.finos.calm.store.github.GitHubBuildingBlockStore;

import java.util.List;

/**
 * Producer for BuildingBlockStore implementations. Only GitHub mode is implemented - restored
 * per PR #3066 review discussion (byrash, 2026-09-24) after the 2026-09-10 removal (#3052),
 * matching the original's scope exactly: mongo and standalone modes get a no-op placeholder,
 * same as before removal.
 */
@ApplicationScoped
public class BuildingBlockStoreProducer {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject
    Instance<GitHubBuildingBlockStore> gitHubBuildingBlockStore;

    @Produces
    @ApplicationScoped
    public BuildingBlockStore produceBuildingBlockStore() {
        if (DatabaseMode.GITHUB.equals(databaseMode)) {
            return gitHubBuildingBlockStore.get();
        }
        // No Mongo or standalone implementation yet — return a no-op that throws on all operations
        return new NoOpBuildingBlockStore();
    }

    /**
     * Placeholder implementation for non-GitHub modes until Mongo/Nitrite support is added.
     */
    private static class NoOpBuildingBlockStore implements BuildingBlockStore {

        private static final String NOT_SUPPORTED =
                "Building blocks are not yet supported in standalone or mongo mode";

        @Override
        public List<NamespaceResourceSummary> getBuildingBlocksForNamespace(String namespace) throws NamespaceNotFoundException {
            throw new UnsupportedOperationException(NOT_SUPPORTED);
        }

        @Override
        public BuildingBlock createBuildingBlockForNamespace(CreateBuildingBlockRequest buildingBlockRequest, String namespace) throws NamespaceNotFoundException {
            throw new UnsupportedOperationException(NOT_SUPPORTED);
        }

        @Override
        public List<String> getBuildingBlockVersions(String namespace, Integer buildingBlockId) throws NamespaceNotFoundException, BuildingBlockNotFoundException {
            throw new UnsupportedOperationException(NOT_SUPPORTED);
        }

        @Override
        public String getBuildingBlockForVersion(String namespace, Integer buildingBlockId, String version) throws NamespaceNotFoundException, BuildingBlockNotFoundException, BuildingBlockVersionNotFoundException {
            throw new UnsupportedOperationException(NOT_SUPPORTED);
        }

        @Override
        public BuildingBlock createBuildingBlockForVersion(CreateBuildingBlockRequest buildingBlockRequest, String namespace, Integer buildingBlockId, String version) throws NamespaceNotFoundException, BuildingBlockNotFoundException, BuildingBlockVersionNotFoundException {
            throw new UnsupportedOperationException(NOT_SUPPORTED);
        }
    }
}
