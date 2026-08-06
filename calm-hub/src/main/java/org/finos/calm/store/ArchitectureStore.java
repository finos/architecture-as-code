package org.finos.calm.store;

import org.finos.calm.domain.*;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.domain.exception.ArchitectureNotFoundException;
import org.finos.calm.domain.exception.ArchitectureVersionExistsException;
import org.finos.calm.domain.exception.ArchitectureVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;

import java.util.List;

public interface ArchitectureStore {
    /**
     * Retrieve all architecture summaries for a namespace (unpaged).
     *
     * @param namespace the namespace to retrieve architectures for
     * @return the full list of architecture summaries
     */
    default List<NamespaceResourceSummary> getArchitecturesForNamespace(String namespace) throws NamespaceNotFoundException {
        return getArchitecturesForNamespace(namespace, PageRequest.UNPAGED);
    }

    /**
     * Retrieve architecture summaries for a namespace, optionally paged.
     *
     * @param namespace the namespace to retrieve architectures for
     * @param page      the optional {@code limit}/{@code offset} paging window
     *                  ({@link PageRequest#UNPAGED} for the full list)
     * @return a (possibly paged) list of architecture summaries
     */
    List<NamespaceResourceSummary> getArchitecturesForNamespace(String namespace, PageRequest page) throws NamespaceNotFoundException;

    /**
     * Reports whether an architecture exists, without fetching its content or versions.
     * Used by resources that reference an architecture id from outside the architecture's
     * own path segment (e.g. {@code LayoutResource}, which addresses
     * {@code .../architectures/{id}/layout} directly) and need to reject a write against an
     * id that resolves to nothing, rather than silently creating an orphan.
     *
     * @param namespace      the namespace the architecture would belong to
     * @param architectureId the id to check
     * @return true if a header document exists for this (namespace, architectureId)
     * @throws NamespaceNotFoundException if the namespace itself does not exist
     */
    boolean architectureExists(String namespace, int architectureId) throws NamespaceNotFoundException;

    Architecture createArchitectureForNamespace(Architecture architecture) throws NamespaceNotFoundException;
    List<String> getArchitectureVersions(Architecture architecture) throws NamespaceNotFoundException, ArchitectureNotFoundException;
    String getArchitectureForVersion(Architecture architecture) throws NamespaceNotFoundException, ArchitectureNotFoundException, ArchitectureVersionNotFoundException;
    Architecture createArchitectureForVersion(Architecture architecture) throws NamespaceNotFoundException, ArchitectureNotFoundException, ArchitectureVersionExistsException;
    Architecture updateArchitectureForVersion(Architecture architecture) throws NamespaceNotFoundException, ArchitectureNotFoundException;
}
