package org.finos.calm.store.github;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.finos.calm.domain.conventions.ConventionDefault;
import org.finos.calm.domain.conventions.ConventionType;
import org.finos.calm.domain.conventions.CreateConventionRequest;
import org.finos.calm.domain.exception.ConventionNotFoundException;
import org.finos.calm.domain.exception.ConventionVersionExistsException;
import org.finos.calm.domain.exception.ConventionVersionNotFoundException;
import org.finos.calm.domain.exception.GitHubWriteNotSupportedException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.store.ConventionStore;
import org.finos.calm.store.github.access.NamespaceFileReader;
import org.finos.calm.store.github.api.GitHubFileHistoryClient;
import org.finos.calm.store.github.registry.ConventionFiles;
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
 * GitHub-mode {@link ConventionStore}: a convention is a JSON file under {@code conventions/<convention-type>/} in the namespace's
 * clone, and {@code conventions/<convention-type>/default.json} is the namespace default, at the clone's HEAD SHA. Versions
 * are commit SHAs, as for the other GitHub stores. Hub does not validate these files against the type's schema,
 * because nothing writes them through Hub. Every write throws {@link GitHubWriteNotSupportedException}.
 */
@ApplicationScoped
@Typed(GitHubConventionStore.class)
public class GitHubConventionStore extends AbstractReadOnlyGitHubStore implements ConventionStore {

    private static final Logger LOG = LoggerFactory.getLogger(GitHubConventionStore.class);

    @Inject
    public GitHubConventionStore(ResourceRegistry registryService, GitHubCloneManager cloneManager,
                             GitHubFileHistoryClient versionService, NamespaceFileReader fileReader) {
        super(registryService, cloneManager, versionService, fileReader);
    }

    @Override
    public List<NamespaceResourceSummary> getConventionsForNamespace(String namespace, ConventionType type)
            throws NamespaceNotFoundException {
        verifyNamespace(namespace);
        return entries(namespace, type)
                .map(e -> new NamespaceResourceSummary(e.name(), null, id(e), 0))
                .toList();
    }

    @Override
    public int createConventionForNamespace(CreateConventionRequest request, String namespace, ConventionType type) {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public List<String> getConventionVersions(String namespace, ConventionType type, int id)
            throws NamespaceNotFoundException, ConventionNotFoundException {
        verifyNamespace(namespace);
        return getVersions(namespace, entry(namespace, type, id));
    }

    @Override
    public String getConventionForVersion(String namespace, ConventionType type, int id, String version)
            throws NamespaceNotFoundException, ConventionNotFoundException, ConventionVersionNotFoundException {
        verifyNamespace(namespace);
        return read(namespace, entry(namespace, type, id), version);
    }

    @Override
    public void createConventionForVersion(CreateConventionRequest request, String namespace, ConventionType type, int id,
                                       String version) throws ConventionVersionExistsException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public Optional<ConventionDefault> getDefault(String namespace, ConventionType type) {
        String headSha = cloneManager.headSha(namespace);
        if (headSha == null) {
            return Optional.empty();
        }
        return defaultEntry(namespace, type).map(e -> new ConventionDefault(type.getName(), namespace, id(e), headSha));
    }

    // Reads default.json itself: another file with the same unique-id has the same id.
    @Override
    public String readDefault(String namespace, ConventionType type, ConventionDefault conventionDefault)
            throws NamespaceNotFoundException, ConventionNotFoundException, ConventionVersionNotFoundException {
        verifyNamespace(namespace);
        RegistryEntry entry = defaultEntry(namespace, type).orElseThrow(ConventionNotFoundException::new);
        return read(namespace, entry, conventionDefault.version());
    }

    @Override
    public ConventionDefault setDefault(String namespace, ConventionType type, int id, String version) {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public boolean deleteDefault(String namespace, ConventionType type) {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public boolean hasContent(String namespace) {
        return !registryService.listByType(namespace, RegistryResourceType.CONVENTION).isEmpty();
    }

    private Stream<RegistryEntry> entries(String namespace, ConventionType type) {
        return registryService.listByType(namespace, RegistryResourceType.CONVENTION).stream()
                .filter(e -> ConventionFiles.conventionType(e.filePath()).filter(type::equals).isPresent());
    }

    private Optional<RegistryEntry> defaultEntry(String namespace, ConventionType type) {
        return entries(namespace, type).filter(e -> ConventionFiles.isDefault(e.filePath())).findFirst();
    }

    private String read(String namespace, RegistryEntry entry, String version) throws ConventionVersionNotFoundException {
        try {
            return readAtVersion(namespace, entry, version).orElseThrow(ConventionVersionNotFoundException::new);
        } catch (IOException e) {
            LOG.error("Failed to read convention file: {}", entry.filePath(), e);
            throw new ConventionVersionNotFoundException();
        }
    }

    private RegistryEntry entry(String namespace, ConventionType type, int id) throws ConventionNotFoundException {
        return entries(namespace, type).filter(e -> id(e) == id).findFirst().orElseThrow(ConventionNotFoundException::new);
    }

    private static int id(RegistryEntry entry) {
        return entry.uniqueId().hashCode() & 0x7FFFFFFF;
    }
}
