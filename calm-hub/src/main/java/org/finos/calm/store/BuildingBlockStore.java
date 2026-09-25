package org.finos.calm.store;

import org.finos.calm.domain.BuildingBlock;
import org.finos.calm.domain.exception.BuildingBlockNotFoundException;
import org.finos.calm.domain.exception.BuildingBlockVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.buildingblocks.CreateBuildingBlockRequest;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;

import java.util.List;

public interface BuildingBlockStore {
    List<NamespaceResourceSummary> getBuildingBlocksForNamespace(String namespace) throws NamespaceNotFoundException;
    BuildingBlock createBuildingBlockForNamespace(CreateBuildingBlockRequest buildingBlockRequest, String namespace) throws NamespaceNotFoundException;
    List<String> getBuildingBlockVersions(String namespace, Integer buildingBlockId) throws NamespaceNotFoundException, BuildingBlockNotFoundException;
    String getBuildingBlockForVersion(String namespace, Integer buildingBlockId, String version) throws NamespaceNotFoundException, BuildingBlockNotFoundException, BuildingBlockVersionNotFoundException;
    BuildingBlock createBuildingBlockForVersion(CreateBuildingBlockRequest buildingBlockRequest, String namespace, Integer buildingBlockId, String version) throws NamespaceNotFoundException, BuildingBlockNotFoundException, BuildingBlockVersionNotFoundException;
}
