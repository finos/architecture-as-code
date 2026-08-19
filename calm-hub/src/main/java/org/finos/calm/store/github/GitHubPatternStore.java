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
import org.finos.calm.store.github.util.CalmResourceType;
import org.finos.calm.store.github.util.InMemoryRegistryService;
import org.finos.calm.store.github.util.RegistryEntry;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

@ApplicationScoped
@Typed(GitHubPatternStore.class)
public class GitHubPatternStore implements PatternStore {

    private static final String WRITE_UNSUPPORTED =
            "Write operations are not yet available. GitHub account linking and PR creation will be enabled in a future release.";

    private final InMemoryRegistryService registryService;

    @Inject
    public GitHubPatternStore(InMemoryRegistryService registryService) {
        this.registryService = registryService;
    }

    @Override
    public List<NamespaceResourceSummary> getPatternsForNamespace(String namespace, PageRequest page) throws NamespaceNotFoundException {
        verifyNamespace(namespace);
        List<RegistryEntry> entries = registryService.listByType(namespace, CalmResourceType.PATTERN);
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
        throw new GitHubWriteNotSupportedException(
                "Version history via GitHub API is not yet implemented.");
    }

    @Override
    public String getPatternForVersion(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException, PatternVersionNotFoundException {
        throw new GitHubWriteNotSupportedException(
                "Version-specific reads via GitHub API are not yet implemented.");
    }

    @Override
    public Pattern createPatternForVersion(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException, PatternVersionExistsException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public Pattern updatePatternForVersion(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    private void verifyNamespace(String namespace) throws NamespaceNotFoundException {
        if (!registryService.getSnapshot().getNamespaces().contains(namespace)) {
            throw new NamespaceNotFoundException();
        }
    }
}
