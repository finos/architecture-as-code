package org.finos.calm.store;

import org.finos.calm.domain.conventions.ConventionDefault;
import org.finos.calm.domain.conventions.ConventionType;
import org.finos.calm.domain.conventions.CreateConventionRequest;
import org.finos.calm.domain.exception.ConventionNotFoundException;
import org.finos.calm.domain.exception.ConventionVersionExistsException;
import org.finos.calm.domain.exception.ConventionVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;

import java.util.List;
import java.util.Optional;

/**
 * Versioned conventions, one set per convention type, and the default convention that each namespace names per type.
 * The caller validates the convention JSON before a write.
 */
public interface ConventionStore {

    List<NamespaceResourceSummary> getConventionsForNamespace(String namespace, ConventionType type)
            throws NamespaceNotFoundException;

    /**
     * @return the id of the new convention, at version 1.0.0
     */
    int createConventionForNamespace(CreateConventionRequest request, String namespace, ConventionType type)
            throws NamespaceNotFoundException;

    List<String> getConventionVersions(String namespace, ConventionType type, int id)
            throws NamespaceNotFoundException, ConventionNotFoundException;

    String getConventionForVersion(String namespace, ConventionType type, int id, String version)
            throws NamespaceNotFoundException, ConventionNotFoundException, ConventionVersionNotFoundException;

    void createConventionForVersion(CreateConventionRequest request, String namespace, ConventionType type, int id, String version)
            throws NamespaceNotFoundException, ConventionNotFoundException, ConventionVersionExistsException;

    /**
     * @return the default that {@code namespace} itself sets, not one it inherits. Empty for a namespace that does
     * not exist.
     */
    Optional<ConventionDefault> getDefault(String namespace, ConventionType type);

    /**
     * @return the JSON of the convention that {@code conventionDefault}, from {@link #getDefault}, names
     */
    default String readDefault(String namespace, ConventionType type, ConventionDefault conventionDefault)
            throws NamespaceNotFoundException, ConventionNotFoundException, ConventionVersionNotFoundException {
        return getConventionForVersion(namespace, type, conventionDefault.conventionId(), conventionDefault.version());
    }

    /**
     * Names a convention version in {@code namespace} as its default for {@code type}, in place of any earlier default.
     */
    ConventionDefault setDefault(String namespace, ConventionType type, int id, String version)
            throws NamespaceNotFoundException, ConventionNotFoundException, ConventionVersionNotFoundException;

    /**
     * @return false if {@code namespace} sets no default for {@code type}
     */
    boolean deleteDefault(String namespace, ConventionType type) throws NamespaceNotFoundException;

    /**
     * @return true if {@code namespace} holds a convention or a default of any type. Guards namespace deletion.
     */
    boolean hasContent(String namespace);
}
