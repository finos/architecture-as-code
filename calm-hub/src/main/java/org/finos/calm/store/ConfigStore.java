package org.finos.calm.store;

import org.finos.calm.domain.configs.ConfigDefault;
import org.finos.calm.domain.configs.ConfigType;
import org.finos.calm.domain.configs.CreateConfigRequest;
import org.finos.calm.domain.exception.ConfigNotFoundException;
import org.finos.calm.domain.exception.ConfigVersionExistsException;
import org.finos.calm.domain.exception.ConfigVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;

import java.util.List;
import java.util.Optional;

/**
 * Versioned configs, one set per config type, and the default config that each namespace names per type.
 * The caller validates the config JSON before a write.
 */
public interface ConfigStore {

    List<NamespaceResourceSummary> getConfigsForNamespace(String namespace, ConfigType type)
            throws NamespaceNotFoundException;

    /**
     * @return the id of the new config, at version 1.0.0
     */
    int createConfigForNamespace(CreateConfigRequest request, String namespace, ConfigType type)
            throws NamespaceNotFoundException;

    List<String> getConfigVersions(String namespace, ConfigType type, int id)
            throws NamespaceNotFoundException, ConfigNotFoundException;

    String getConfigForVersion(String namespace, ConfigType type, int id, String version)
            throws NamespaceNotFoundException, ConfigNotFoundException, ConfigVersionNotFoundException;

    void createConfigForVersion(CreateConfigRequest request, String namespace, ConfigType type, int id, String version)
            throws NamespaceNotFoundException, ConfigNotFoundException, ConfigVersionExistsException;

    /**
     * @return the default that {@code namespace} itself sets, not one it inherits. Empty for a namespace that does
     * not exist.
     */
    Optional<ConfigDefault> getDefault(String namespace, ConfigType type);

    /**
     * Names a config version in {@code namespace} as its default for {@code type}, in place of any earlier default.
     */
    ConfigDefault setDefault(String namespace, ConfigType type, int id, String version)
            throws NamespaceNotFoundException, ConfigNotFoundException, ConfigVersionNotFoundException;

    /**
     * @return false if {@code namespace} sets no default for {@code type}
     */
    boolean deleteDefault(String namespace, ConfigType type) throws NamespaceNotFoundException;

    /**
     * @return true if {@code namespace} holds a config or a default of any type. Guards namespace deletion.
     */
    boolean hasContent(String namespace);
}
