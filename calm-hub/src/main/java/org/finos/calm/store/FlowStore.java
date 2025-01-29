package org.finos.calm.store;

import org.finos.calm.domain.*;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.FlowNotFoundException;
import org.finos.calm.domain.exception.FlowVersionExistsException;
import org.finos.calm.domain.exception.FlowVersionNotFoundException;

import java.util.List;

public interface FlowStore {
    List<Integer> getFlowsForNamespace(String namespace) throws NamespaceNotFoundException;
    Flow createFlowForNamespace(Flow flow) throws NamespaceNotFoundException;
    List<String> getFlowVersions(Flow flow) throws NamespaceNotFoundException, FlowNotFoundException;
    String getFlowForVersion(Flow flow) throws NamespaceNotFoundException, FlowNotFoundException, FlowVersionNotFoundException;
    Flow createFlowForVersion(Flow flow) throws NamespaceNotFoundException, FlowNotFoundException, FlowVersionExistsException;
    Flow updateFlowForVersion(Flow flow) throws NamespaceNotFoundException, FlowNotFoundException;
}
