package org.finos.calm.store.github;

import org.finos.calm.domain.exception.GitHubWriteNotSupportedException;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.finos.calm.domain.Standard;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.StandardNotFoundException;
import org.finos.calm.domain.exception.StandardVersionExistsException;
import org.finos.calm.domain.exception.StandardVersionNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.domain.standards.CreateStandardRequest;
import org.finos.calm.store.StandardStore;
import org.finos.calm.store.github.registry.RegistryResourceType;
import org.finos.calm.store.github.sync.GitHubCloneManager;
import org.finos.calm.store.github.access.NamespaceFileReader;
import org.finos.calm.store.github.api.GitHubFileHistoryClient;
import org.finos.calm.store.github.registry.ResourceRegistry;
import org.finos.calm.store.github.registry.RegistryEntry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Path;
import java.util.List;

/**
 * GitHub-mode {@link StandardStore}: standards are read from files under {@code standards/}
 * and {@code building-blocks/} in the namespace's clone (the two directories are merged into
 * one listing - see {@link org.finos.calm.store.github.registry.CalmContentDetector} for why
 * {@code building-blocks/} maps to {@code STANDARD} rather than a separate concept). Id
 * lookup, version listing and version-content resolution all delegate to
 * {@link AbstractReadOnlyGitHubStore} - see its class javadoc for why an unresolvable version
 * 404s rather than silently reading whatever HEAD holds. The one thing this store adds beyond
 * that shared behaviour is {@link #preferMarkdownSibling}: standards render better as prose,
 * so a JSON entry with a same-named {@code .md} sibling serves that sibling instead - but only
 * for the local-HEAD read, never for a pinned-SHA API fetch (see that method's javadoc for
 * why). Every mutating method throws {@link GitHubWriteNotSupportedException}: this backend is
 * read-only until GitHub account linking and PR creation land.
 */
@ApplicationScoped
@Typed(GitHubStandardStore.class)
public class GitHubStandardStore extends AbstractReadOnlyGitHubStore implements StandardStore {

    private static final Logger LOG = LoggerFactory.getLogger(GitHubStandardStore.class);

    @Inject
    public GitHubStandardStore(ResourceRegistry registryService, GitHubCloneManager cloneManager,
                                GitHubFileHistoryClient versionService, NamespaceFileReader fileReader) {
        super(registryService, cloneManager, versionService, fileReader);
    }

    @Override
    public List<NamespaceResourceSummary> getStandardsForNamespace(String namespace) throws NamespaceNotFoundException {
        verifyNamespace(namespace);
        List<RegistryEntry> entries = registryService.listByType(namespace, RegistryResourceType.STANDARD);
        return entries.stream()
                .map(e -> new NamespaceResourceSummary(e.name(), e.uniqueId(), (e.uniqueId().hashCode() & 0x7FFFFFFF), 0))
                .toList();
    }

    @Override
    public Standard createStandardForNamespace(CreateStandardRequest standardRequest, String namespace) throws NamespaceNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public List<String> getStandardVersions(String namespace, Integer standardId) throws NamespaceNotFoundException, StandardNotFoundException {
        verifyNamespace(namespace);
        RegistryEntry entry = findEntry(namespace, RegistryResourceType.STANDARD, standardId)
                .orElseThrow(StandardNotFoundException::new);
        return getVersions(namespace, entry);
    }

    @Override
    public String getStandardForVersion(String namespace, Integer standardId, String version) throws NamespaceNotFoundException, StandardNotFoundException, StandardVersionNotFoundException {
        verifyNamespace(namespace);
        RegistryEntry entry = findEntry(namespace, RegistryResourceType.STANDARD, standardId)
                .orElseThrow(StandardNotFoundException::new);
        try {
            return readAtVersion(namespace, entry, version, preferMarkdownSibling(namespace, entry.filePath()))
                    .orElseThrow(StandardVersionNotFoundException::new);
        } catch (IOException e) {
            LOG.error("Failed to read standard file: {}", entry.filePath(), e);
            throw new StandardVersionNotFoundException();
        }
    }

    // Standards render better as prose: when the JSON entry has a same-named .md sibling,
    // the local-HEAD read prefers it - but only for the local read. A pinned-SHA fetch via
    // the GitHub API (in readAtVersion's other branch) always targets entry.filePath()
    // regardless, since the API request is keyed on the JSON file's own version history,
    // not the sibling's.
    private Path preferMarkdownSibling(String namespace, Path relativeFilePath) {
        if (!relativeFilePath.toString().endsWith(".json")) {
            return relativeFilePath;
        }
        String baseName = relativeFilePath.getFileName().toString()
                .replaceAll("\\.(guideline|standard|calm)\\.json$", "")
                .replace(".json", "");
        Path relativeMdSibling = relativeFilePath.resolveSibling(baseName + ".md");
        return fileReader.existsContained(namespace, relativeMdSibling) ? relativeMdSibling : relativeFilePath;
    }

    @Override
    public Standard createStandardForVersion(CreateStandardRequest standardRequest, String namespace, Integer standardId, String version) throws NamespaceNotFoundException, StandardNotFoundException, StandardVersionExistsException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public void deleteStandard(String namespace, Integer standardId) throws NamespaceNotFoundException, StandardNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }
}
