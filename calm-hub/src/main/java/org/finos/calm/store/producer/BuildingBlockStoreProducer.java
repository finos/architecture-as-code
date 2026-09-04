package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.config.DatabaseMode;
import org.finos.calm.store.BuildingBlockStore;
import org.finos.calm.store.github.GitHubBuildingBlockStore;

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
        public java.util.List<org.finos.calm.domain.namespaces.NamespaceResourceSummary> getBuildingBlocksForNamespace(String namespace) {
            throw new UnsupportedOperationException(NOT_SUPPORTED);
        }

        @Override
        public int createBuildingBlockForNamespace(String namespace, String buildingBlockJson) {
            throw new UnsupportedOperationException(NOT_SUPPORTED);
        }

        @Override
        public java.util.List<String> getBuildingBlockVersions(String namespace, int buildingBlockId) {
            throw new UnsupportedOperationException(NOT_SUPPORTED);
        }

        @Override
        public String getBuildingBlockForVersion(String namespace, int buildingBlockId, String version) {
            throw new UnsupportedOperationException(NOT_SUPPORTED);
        }

        @Override
        public void createBuildingBlockForVersion(String namespace, int buildingBlockId, String version, String buildingBlockJson) {
            throw new UnsupportedOperationException(NOT_SUPPORTED);
        }
    }
}
