package org.finos.calm.store.github;

import org.finos.calm.domain.exception.GitHubWriteNotSupportedException;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.bson.json.JsonParseException;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.domain.Pattern;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.PatternNotFoundException;
import org.finos.calm.domain.exception.PatternVersionExistsException;
import org.finos.calm.domain.exception.PatternVersionNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.domain.pattern.CreatePatternRequest;
import org.finos.calm.store.PageRequest;
import org.finos.calm.store.PatternStore;
import org.finos.calm.store.github.util.CalmResourceType;
import org.finos.calm.store.github.util.GitHubCloneManager;
import org.finos.calm.store.github.util.GitHubVersionService;
import org.finos.calm.store.github.util.InMemoryRegistryService;
import org.finos.calm.store.github.util.RegistryEntry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;

@ApplicationScoped
@Typed(GitHubPatternStore.class)
public class GitHubPatternStore implements PatternStore {

    private static final String WRITE_UNSUPPORTED =
            "Write operations are not yet available. GitHub account linking and PR creation will be enabled in a future release.";

    private static final Logger LOG = LoggerFactory.getLogger(GitHubPatternStore.class);

    private final InMemoryRegistryService registryService;

    @Inject
    @ConfigProperty(name = "calm.github.clone-directory", defaultValue = "/tmp/calm-hub-clones")
    String cloneDirectory;

    @Inject
    GitHubCloneManager cloneManager;

    @Inject
    GitHubVersionService versionService;

    @Inject
    public GitHubPatternStore(InMemoryRegistryService registryService) {
        this.registryService = registryService;
    }

    @Override
    public List<NamespaceResourceSummary> getPatternsForNamespace(String namespace, PageRequest page) throws NamespaceNotFoundException {
        verifyNamespace(namespace);
        List<RegistryEntry> entries = registryService.listByType(namespace, CalmResourceType.PATTERN);
        String repo = cloneManager != null ? cloneManager.getRepoForNamespace(namespace) : null;
        return entries.stream()
                .map(e -> {
                    
                    if (repo != null && versionService != null) {
                    }
                    return new NamespaceResourceSummary(e.name(), e.uniqueId(), (e.uniqueId().hashCode() & 0x7FFFFFFF), 0);
                })
                .toList();
    }

    @Override
    public Pattern createPatternForNamespace(CreatePatternRequest patternRequest, String namespace) throws NamespaceNotFoundException, JsonParseException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public List<String> getPatternVersions(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException {
        verifyNamespace(pattern.getNamespace());
        RegistryEntry entry = findEntryById(pattern.getNamespace(), pattern.getId());
        String repo = cloneManager != null ? cloneManager.getRepoForNamespace(pattern.getNamespace()) : null;
        if (repo != null && versionService != null) {
            return versionService.getFileVersions(repo, entry.filePath().toString());
        }
        return List.of("latest");
    }

    @Override
    public String getPatternForVersion(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException, PatternVersionNotFoundException {
        verifyNamespace(pattern.getNamespace());
        RegistryEntry entry = findEntryById(pattern.getNamespace(), pattern.getId());
        String version = pattern.getDotVersion();

        // If a specific SHA is requested and version service is available, fetch from GitHub API
        if (version != null && !version.equals("latest") && version.matches("[0-9a-f]{7,40}")
                && cloneManager != null && versionService != null) {
            String repo = cloneManager.getRepoForNamespace(pattern.getNamespace());
            if (repo != null) {
                String content = versionService.getFileAtVersion(repo, entry.filePath().toString(), version);
                if (content != null) {
                    return content;
                }
            }
        }

        // Fallback: read from local clone (latest/HEAD)
        try {
            Path filePath = Path.of(cloneDirectory, pattern.getNamespace()).resolve(entry.filePath());
            return Files.readString(filePath);
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

    private RegistryEntry findEntryById(String namespace, int id) throws PatternNotFoundException {
        List<RegistryEntry> entries = registryService.listByType(namespace, CalmResourceType.PATTERN);
        Optional<RegistryEntry> found = entries.stream()
                .filter(e -> (e.uniqueId().hashCode() & 0x7FFFFFFF) == id)
                .findFirst();
        if (found.isEmpty()) {
            throw new PatternNotFoundException();
        }
        return found.get();
    }

    private void verifyNamespace(String namespace) throws NamespaceNotFoundException {
        if (!registryService.getSnapshot().getNamespaces().contains(namespace)) {
            throw new NamespaceNotFoundException();
        }
    }
}
