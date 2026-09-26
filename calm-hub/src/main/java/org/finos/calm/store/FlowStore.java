package org.finos.calm.store;

import org.finos.calm.domain.*;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.FlowNotFoundException;
import org.finos.calm.domain.exception.FlowVersionExistsException;
import org.finos.calm.domain.exception.FlowVersionNotFoundException;
import org.finos.calm.domain.flow.CreateFlowRequest;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;

import java.util.List;

public interface FlowStore {
    List<NamespaceResourceSummary> getFlowsForNamespace(String namespace) throws NamespaceNotFoundException;
    Flow createFlowForNamespace(CreateFlowRequest flowRequest, String namespace, String version) throws NamespaceNotFoundException;
    List<String> getFlowVersions(Flow flow) throws NamespaceNotFoundException, FlowNotFoundException;
    String getFlowForVersion(Flow flow) throws NamespaceNotFoundException, FlowNotFoundException, FlowVersionNotFoundException;
    Flow createFlowForVersion(Flow flow) throws NamespaceNotFoundException, FlowNotFoundException, FlowVersionExistsException;
    Flow updateFlowForVersion(Flow flow) throws NamespaceNotFoundException, FlowNotFoundException;

    /**
     * Deletes a flow and all of its versions.
     */
    void deleteFlow(String namespace, int flowId) throws NamespaceNotFoundException, FlowNotFoundException;

    /**
     * Removes one version, leaving the resource and its other versions in place. Used by
     * promotion to delete a snapshot once its release version is published.
     *
     * @return {@code true} if a version was removed.
     */
    boolean deleteFlowVersion(String namespace, int flowId, String version)
            throws NamespaceNotFoundException, FlowNotFoundException;
}
