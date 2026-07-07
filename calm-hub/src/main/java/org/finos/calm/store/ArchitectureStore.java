package org.finos.calm.store;

import org.finos.calm.domain.*;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.domain.exception.ArchitectureNotFoundException;
import org.finos.calm.domain.exception.ArchitectureVersionExistsException;
import org.finos.calm.domain.exception.ArchitectureVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;

import java.util.List;

public interface ArchitectureStore {
    List<NamespaceResourceSummary> getArchitecturesForNamespace(String namespace) throws NamespaceNotFoundException;

    /**
     * Retrieve architecture summaries for a namespace, optionally limited and offset.
     *
     * @param namespace the namespace to retrieve architectures for
     * @param limit     the maximum number of summaries to return, or {@code null} for no limit
     * @param offset    the number of summaries to skip, or {@code null} for none
     * @return a (possibly limited) list of architecture summaries
     */
    List<NamespaceResourceSummary> getArchitecturesForNamespace(String namespace, Integer limit, Integer offset) throws NamespaceNotFoundException;
    Architecture createArchitectureForNamespace(Architecture architecture) throws NamespaceNotFoundException;
    List<String> getArchitectureVersions(Architecture architecture) throws NamespaceNotFoundException, ArchitectureNotFoundException;
    String getArchitectureForVersion(Architecture architecture) throws NamespaceNotFoundException, ArchitectureNotFoundException, ArchitectureVersionNotFoundException;
    Architecture createArchitectureForVersion(Architecture architecture) throws NamespaceNotFoundException, ArchitectureNotFoundException, ArchitectureVersionExistsException;
    Architecture updateArchitectureForVersion(Architecture architecture) throws NamespaceNotFoundException, ArchitectureNotFoundException;
}
