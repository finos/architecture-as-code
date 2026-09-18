package org.finos.calm.store;

import org.finos.calm.domain.Standard;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.StandardNotFoundException;
import org.finos.calm.domain.exception.StandardVersionExistsException;
import org.finos.calm.domain.exception.StandardVersionNotFoundException;
import org.finos.calm.domain.standards.CreateStandardRequest;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;

import java.util.List;

public interface StandardStore {
    List<NamespaceResourceSummary> getStandardsForNamespace(String namespace) throws NamespaceNotFoundException;
    Standard createStandardForNamespace(CreateStandardRequest standardRequest, String namespace) throws NamespaceNotFoundException;
    List<String> getStandardVersions(String namespace, Integer standardId) throws NamespaceNotFoundException, StandardNotFoundException;
    String getStandardForVersion(String namespace, Integer standardId, String version) throws NamespaceNotFoundException, StandardNotFoundException, StandardVersionNotFoundException;
    Standard createStandardForVersion(CreateStandardRequest standardRequest, String namespace, Integer standardId, String version) throws NamespaceNotFoundException, StandardNotFoundException, StandardVersionExistsException;

    /**
     * Overwrites an existing version in place. Used by the snapshot path, where a version is
     * mutable by design. Unlike {@link #createStandardForVersion} this does not reject an
     * existing version.
     */
    Standard updateStandardForVersion(CreateStandardRequest standardRequest, String namespace,
                                      Integer standardId, String version)
            throws NamespaceNotFoundException, StandardNotFoundException;

    /**
     * Deletes a standard and all of its versions.
     */
    void deleteStandard(String namespace, Integer standardId) throws NamespaceNotFoundException, StandardNotFoundException;

    /**
     * Removes one version, leaving the resource and its other versions in place. Used by
     * promotion to delete a snapshot once its release version is published.
     *
     * @return {@code true} if a version was removed.
     */
    boolean deleteStandardVersion(String namespace, int standardId, String version)
            throws NamespaceNotFoundException, StandardNotFoundException;
}
