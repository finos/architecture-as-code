package org.finos.calm.store.github;

import org.finos.calm.domain.exception.GitHubWriteNotSupportedException;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.bson.json.JsonParseException;
import org.finos.calm.domain.Pattern;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.PatternNotFoundException;
import org.finos.calm.domain.exception.PatternVersionExistsException;
import org.finos.calm.domain.exception.PatternVersionNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.domain.pattern.CreatePatternRequest;
import org.finos.calm.store.PageRequest;
import org.finos.calm.store.PatternStore;
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
 * GitHub-mode {@link PatternStore}: patterns are read from the {@code .json} files under
 * {@code patterns/} in the namespace's clone, classified into the registry by
 * {@link org.finos.calm.store.github.registry.CalmContentDetector}. Id lookup, version listing
 * and version-content resolution all delegate to {@link AbstractReadOnlyGitHubStore} - see its
 * class javadoc for why an unresolvable version 404s rather than silently reading whatever
 * HEAD holds. Every mutating method throws {@link GitHubWriteNotSupportedException}: this
 * backend is read-only until GitHub account linking and PR creation land.
 */
@ApplicationScoped
@Typed(GitHubPatternStore.class)
public class GitHubPatternStore extends AbstractReadOnlyGitHubStore implements PatternStore {

    private static final Logger LOG = LoggerFactory.getLogger(GitHubPatternStore.class);

    @Inject
    public GitHubPatternStore(ResourceRegistry registryService, GitHubCloneManager cloneManager,
                               GitHubFileHistoryClient versionService, NamespaceFileReader fileReader) {
        super(registryService, cloneManager, versionService, fileReader);
    }

    @Override
    public List<NamespaceResourceSummary> getPatternsForNamespace(String namespace, PageRequest page) throws NamespaceNotFoundException {
        verifyNamespace(namespace);
        List<RegistryEntry> entries = registryService.listByType(namespace, RegistryResourceType.PATTERN);
        return entries.stream()
                .map(e -> new NamespaceResourceSummary(e.name(), e.uniqueId(), (e.uniqueId().hashCode() & 0x7FFFFFFF), 0))
                .toList();
    }

    @Override
    public Pattern createPatternForNamespace(CreatePatternRequest patternRequest, String namespace) throws NamespaceNotFoundException, JsonParseException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public List<String> getPatternVersions(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException {
        verifyNamespace(pattern.getNamespace());
        RegistryEntry entry = findEntry(pattern.getNamespace(), RegistryResourceType.PATTERN, pattern.getId())
                .orElseThrow(PatternNotFoundException::new);
        return getVersions(pattern.getNamespace(), entry);
    }

    @Override
    public String getPatternForVersion(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException, PatternVersionNotFoundException {
        verifyNamespace(pattern.getNamespace());
        RegistryEntry entry = findEntry(pattern.getNamespace(), RegistryResourceType.PATTERN, pattern.getId())
                .orElseThrow(PatternNotFoundException::new);
        try {
            return readAtVersion(pattern.getNamespace(), entry, pattern.getDotVersion())
                    .orElseThrow(PatternVersionNotFoundException::new);
        } catch (IOException e) {
            LOG.error("Failed to read pattern file: {}", entry.filePath(), e);
            throw new PatternVersionNotFoundException();
        }
    }

    @Override
    public Pattern createPatternForVersion(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException, PatternVersionExistsException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public Pattern updatePatternForVersion(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public void deletePattern(String namespace, int patternId) throws NamespaceNotFoundException, PatternNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }
}
