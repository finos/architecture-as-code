package org.finos.calm.store.github;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.finos.calm.domain.exception.GitHubWriteNotSupportedException;
import org.finos.calm.domain.Architecture;
import org.finos.calm.domain.exception.ArchitectureNotFoundException;
import org.finos.calm.domain.exception.ArchitectureVersionExistsException;
import org.finos.calm.domain.exception.ArchitectureVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.store.ArchitectureStore;
import org.finos.calm.store.PageRequest;
import org.finos.calm.store.github.registry.RegistryResourceType;
import org.finos.calm.store.github.sync.GitHubCloneManager;
import org.finos.calm.store.github.access.NamespaceFileReader;
import org.finos.calm.store.github.api.GitHubFileHistoryClient;
import org.finos.calm.store.github.registry.ResourceRegistry;
import org.finos.calm.store.github.registry.RegistryEntry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.List;

/**
 * GitHub-mode {@link ArchitectureStore}: architectures are read from the {@code .json} files
 * under {@code architectures/} in the namespace's clone, classified into the registry by
 * {@link org.finos.calm.store.github.registry.CalmContentDetector}. Id lookup, version listing
 * and version-content resolution all delegate to {@link AbstractReadOnlyGitHubStore} - see its
 * class javadoc for why an unresolvable version 404s rather than silently reading whatever
 * HEAD holds. Every mutating method throws {@link GitHubWriteNotSupportedException}: this
 * backend is read-only until GitHub account linking and PR creation land.
 */
@ApplicationScoped
@Typed(GitHubArchitectureStore.class)
public class GitHubArchitectureStore extends AbstractReadOnlyGitHubStore implements ArchitectureStore {

    private static final Logger LOG = LoggerFactory.getLogger(GitHubArchitectureStore.class);

    @Inject
    public GitHubArchitectureStore(ResourceRegistry registryService, GitHubCloneManager cloneManager,
                                    GitHubFileHistoryClient versionService, NamespaceFileReader fileReader) {
        super(registryService, cloneManager, versionService, fileReader);
    }

    @Override
    public List<NamespaceResourceSummary> getArchitecturesForNamespace(String namespace, PageRequest page) throws NamespaceNotFoundException {
        verifyNamespace(namespace);
        List<RegistryEntry> entries = registryService.listByType(namespace, RegistryResourceType.ARCHITECTURE);
        return entries.stream()
                .map(e -> new NamespaceResourceSummary(e.name(), e.uniqueId(), (e.uniqueId().hashCode() & 0x7FFFFFFF), 0))
                .toList();
    }

    @Override
    public Architecture createArchitectureForNamespace(Architecture architecture) throws NamespaceNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public List<String> getArchitectureVersions(Architecture architecture) throws NamespaceNotFoundException, ArchitectureNotFoundException {
        verifyNamespace(architecture.getNamespace());
        RegistryEntry entry = findEntry(architecture.getNamespace(), RegistryResourceType.ARCHITECTURE, architecture.getId())
                .orElseThrow(ArchitectureNotFoundException::new);
        return getVersions(architecture.getNamespace(), entry);
    }

    @Override
    public String getArchitectureForVersion(Architecture architecture) throws NamespaceNotFoundException, ArchitectureNotFoundException, ArchitectureVersionNotFoundException {
        verifyNamespace(architecture.getNamespace());
        RegistryEntry entry = findEntry(architecture.getNamespace(), RegistryResourceType.ARCHITECTURE, architecture.getId())
                .orElseThrow(ArchitectureNotFoundException::new);
        try {
            return readAtVersion(architecture.getNamespace(), entry, architecture.getDotVersion())
                    .orElseThrow(ArchitectureVersionNotFoundException::new);
        } catch (IOException e) {
            LOG.error("Failed to read architecture file: {}", entry.filePath(), e);
            throw new ArchitectureVersionNotFoundException();
        }
    }

    @Override
    public Architecture createArchitectureForVersion(Architecture architecture) throws NamespaceNotFoundException, ArchitectureNotFoundException, ArchitectureVersionExistsException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public Architecture updateArchitectureForVersion(Architecture architecture) throws NamespaceNotFoundException, ArchitectureNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public void deleteArchitecture(String namespace, int architectureId) throws NamespaceNotFoundException, ArchitectureNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }
}
