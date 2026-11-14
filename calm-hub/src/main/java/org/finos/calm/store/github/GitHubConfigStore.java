package org.finos.calm.store.github;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.finos.calm.domain.configs.ConfigDefault;
import org.finos.calm.domain.configs.ConfigType;
import org.finos.calm.domain.configs.CreateConfigRequest;
import org.finos.calm.domain.exception.ConfigNotFoundException;
import org.finos.calm.domain.exception.ConfigVersionExistsException;
import org.finos.calm.domain.exception.ConfigVersionNotFoundException;
import org.finos.calm.domain.exception.GitHubWriteNotSupportedException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.store.ConfigStore;
import org.finos.calm.store.github.access.NamespaceFileReader;
import org.finos.calm.store.github.api.GitHubFileHistoryClient;
import org.finos.calm.store.github.registry.ConfigFiles;
import org.finos.calm.store.github.registry.RegistryEntry;
import org.finos.calm.store.github.registry.RegistryResourceType;
import org.finos.calm.store.github.registry.ResourceRegistry;
import org.finos.calm.store.github.sync.GitHubCloneManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

/**
 * GitHub-mode {@link ConfigStore}: a config is a JSON file under {@code configs/<config-type>/} in the namespace's
 * clone, and {@code configs/<config-type>/default.json} is the namespace default, at the clone's HEAD SHA. Versions
 * are commit SHAs, as for the other GitHub stores. Hub does not validate these files against the type's schema,
 * because nothing writes them through Hub. Every write throws {@link GitHubWriteNotSupportedException}.
 */
@ApplicationScoped
@Typed(GitHubConfigStore.class)
public class GitHubConfigStore extends AbstractReadOnlyGitHubStore implements ConfigStore {

    private static final Logger LOG = LoggerFactory.getLogger(GitHubConfigStore.class);

    @Inject
    public GitHubConfigStore(ResourceRegistry registryService, GitHubCloneManager cloneManager,
                             GitHubFileHistoryClient versionService, NamespaceFileReader fileReader) {
        super(registryService, cloneManager, versionService, fileReader);
    }

    @Override
    public List<NamespaceResourceSummary> getConfigsForNamespace(String namespace, ConfigType type)
            throws NamespaceNotFoundException {
        verifyNamespace(namespace);
        return entries(namespace, type)
                .map(e -> new NamespaceResourceSummary(e.name(), null, id(e), 0))
                .toList();
    }

    @Override
    public int createConfigForNamespace(CreateConfigRequest request, String namespace, ConfigType type) {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public List<String> getConfigVersions(String namespace, ConfigType type, int id)
            throws NamespaceNotFoundException, ConfigNotFoundException {
        verifyNamespace(namespace);
        return getVersions(namespace, entry(namespace, type, id));
    }

    @Override
    public String getConfigForVersion(String namespace, ConfigType type, int id, String version)
            throws NamespaceNotFoundException, ConfigNotFoundException, ConfigVersionNotFoundException {
        verifyNamespace(namespace);
        RegistryEntry entry = entry(namespace, type, id);
        try {
            return readAtVersion(namespace, entry, version).orElseThrow(ConfigVersionNotFoundException::new);
        } catch (IOException e) {
            LOG.error("Failed to read config file: {}", entry.filePath(), e);
            throw new ConfigVersionNotFoundException();
        }
    }

    @Override
    public void createConfigForVersion(CreateConfigRequest request, String namespace, ConfigType type, int id,
                                       String version) throws ConfigVersionExistsException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public Optional<ConfigDefault> getDefault(String namespace, ConfigType type) {
        String headSha = cloneManager.headSha(namespace);
        if (headSha == null) {
            return Optional.empty();
        }
        return entries(namespace, type)
                .filter(e -> ConfigFiles.isDefault(e.filePath()))
                .findFirst()
                .map(e -> new ConfigDefault(type.getName(), namespace, id(e), headSha));
    }

    @Override
    public ConfigDefault setDefault(String namespace, ConfigType type, int id, String version) {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public boolean deleteDefault(String namespace, ConfigType type) {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public boolean hasContent(String namespace) {
        return !registryService.listByType(namespace, RegistryResourceType.CONFIG).isEmpty();
    }

    private Stream<RegistryEntry> entries(String namespace, ConfigType type) {
        return registryService.listByType(namespace, RegistryResourceType.CONFIG).stream()
                .filter(e -> ConfigFiles.configType(e.filePath()).filter(type::equals).isPresent());
    }

    private RegistryEntry entry(String namespace, ConfigType type, int id) throws ConfigNotFoundException {
        return entries(namespace, type).filter(e -> id(e) == id).findFirst().orElseThrow(ConfigNotFoundException::new);
    }

    private static int id(RegistryEntry entry) {
        return entry.uniqueId().hashCode() & 0x7FFFFFFF;
    }
}
