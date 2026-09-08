package org.finos.calm.store;

import org.finos.calm.domain.exception.BuildingBlockNotFoundException;
import org.finos.calm.domain.exception.BuildingBlockVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;

import java.util.List;

public interface BuildingBlockStore {
    List<NamespaceResourceSummary> getBuildingBlocksForNamespace(String namespace) throws NamespaceNotFoundException;
    int createBuildingBlockForNamespace(String namespace, String buildingBlockJson) throws NamespaceNotFoundException;
    List<String> getBuildingBlockVersions(String namespace, int buildingBlockId) throws NamespaceNotFoundException, BuildingBlockNotFoundException;
    String getBuildingBlockForVersion(String namespace, int buildingBlockId, String version) throws NamespaceNotFoundException, BuildingBlockNotFoundException, BuildingBlockVersionNotFoundException;
    void createBuildingBlockForVersion(String namespace, int buildingBlockId, String version, String buildingBlockJson) throws NamespaceNotFoundException, BuildingBlockNotFoundException, BuildingBlockVersionNotFoundException;
}
