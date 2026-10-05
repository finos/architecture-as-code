package org.finos.calm.store;

import org.finos.calm.domain.CalmInterface;
import org.finos.calm.domain.exception.InterfaceNotFoundException;
import org.finos.calm.domain.exception.InterfaceVersionExistsException;
import org.finos.calm.domain.exception.InterfaceVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.interfaces.CreateInterfaceRequest;
import org.finos.calm.domain.interfaces.NamespaceInterfaceSummary;

import java.util.List;

public interface InterfaceStore {
    List<NamespaceInterfaceSummary> getInterfacesForNamespace(String namespace) throws NamespaceNotFoundException;
    CalmInterface createInterfaceForNamespace(CreateInterfaceRequest interfaceRequest, String namespace, String version) throws NamespaceNotFoundException;
    List<String> getInterfaceVersions(String namespace, Integer interfaceId) throws NamespaceNotFoundException, InterfaceNotFoundException;
    String getInterfaceForVersion(String namespace, Integer interfaceId, String version) throws NamespaceNotFoundException, InterfaceNotFoundException, InterfaceVersionNotFoundException;
    CalmInterface createInterfaceForVersion(CreateInterfaceRequest interfaceRequest, String namespace, Integer interfaceId, String version) throws NamespaceNotFoundException, InterfaceNotFoundException, InterfaceVersionExistsException;

    /**
     * Overwrites an existing version in place. Used by the snapshot path, where a version is
     * mutable by design. Unlike {@link #createInterfaceForVersion} this does not reject an
     * existing version.
     */
    CalmInterface updateInterfaceForVersion(CreateInterfaceRequest interfaceRequest, String namespace,
                                            Integer interfaceId, String version)
            throws NamespaceNotFoundException, InterfaceNotFoundException;

    /**
     * Deletes an interface and all of its versions.
     */
    void deleteInterface(String namespace, Integer interfaceId) throws NamespaceNotFoundException, InterfaceNotFoundException;

    /**
     * Removes one version, leaving the resource and its other versions in place. Used by
     * promotion to delete a snapshot once its release version is published.
     *
     * @return {@code true} if a version was removed.
     */
    boolean deleteInterfaceVersion(String namespace, int interfaceId, String version)
            throws NamespaceNotFoundException, InterfaceNotFoundException;
}
