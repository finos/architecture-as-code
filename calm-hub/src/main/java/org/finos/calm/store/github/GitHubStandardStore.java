package org.finos.calm.store.github;

import org.finos.calm.domain.exception.GitHubWriteNotSupportedException;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.domain.Standard;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.StandardNotFoundException;
import org.finos.calm.domain.exception.StandardVersionExistsException;
import org.finos.calm.domain.exception.StandardVersionNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.domain.standards.CreateStandardRequest;
import org.finos.calm.store.StandardStore;
import org.finos.calm.store.github.util.CalmResourceType;
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
@Typed(GitHubStandardStore.class)
public class GitHubStandardStore implements StandardStore {

    private static final String WRITE_UNSUPPORTED =
            "Write operations are not yet available. GitHub account linking and PR creation will be enabled in a future release.";

    private static final Logger LOG = LoggerFactory.getLogger(GitHubStandardStore.class);

    private final InMemoryRegistryService registryService;

    @Inject
    @ConfigProperty(name = "calm.github.clone-directory", defaultValue = "/tmp/calm-hub-clones")
    String cloneDirectory;

    @Inject
    public GitHubStandardStore(InMemoryRegistryService registryService) {
        this.registryService = registryService;
    }

    @Override
    public List<NamespaceResourceSummary> getStandardsForNamespace(String namespace) throws NamespaceNotFoundException {
        verifyNamespace(namespace);
        List<RegistryEntry> entries = registryService.listByType(namespace, CalmResourceType.STANDARD);
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
        findEntryById(namespace, standardId);
        return List.of("latest");
    }

    @Override
    public String getStandardForVersion(String namespace, Integer standardId, String version) throws NamespaceNotFoundException, StandardNotFoundException, StandardVersionNotFoundException {
        verifyNamespace(namespace);
        RegistryEntry entry = findEntryById(namespace, standardId);
        try {
            Path filePath = Path.of(cloneDirectory, namespace).resolve(entry.filePath());
            // If this is a JSON file, check for a sibling .md file and prefer it
            if (filePath.toString().endsWith(".json")) {
                String baseName = filePath.getFileName().toString()
                        .replaceAll("\\.(guideline|standard|calm)\\.json$", "")
                        .replace(".json", "");
                Path mdSibling = filePath.getParent().resolve(baseName + ".md");
                if (Files.exists(mdSibling)) {
                    return Files.readString(mdSibling);
                }
            }
            return Files.readString(filePath);
        } catch (IOException e) {
            LOG.error("Failed to read standard file: {}", entry.filePath(), e);
            throw new StandardVersionNotFoundException();
        }
    }

    @Override
    public Standard createStandardForVersion(CreateStandardRequest standardRequest, String namespace, Integer standardId, String version) throws NamespaceNotFoundException, StandardNotFoundException, StandardVersionExistsException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    private RegistryEntry findEntryById(String namespace, int id) throws StandardNotFoundException {
        List<RegistryEntry> entries = registryService.listByType(namespace, CalmResourceType.STANDARD);
        Optional<RegistryEntry> found = entries.stream()
                .filter(e -> (e.uniqueId().hashCode() & 0x7FFFFFFF) == id)
                .findFirst();
        if (found.isEmpty()) {
            throw new StandardNotFoundException();
        }
        return found.get();
    }

    private void verifyNamespace(String namespace) throws NamespaceNotFoundException {
        if (!registryService.getSnapshot().getNamespaces().contains(namespace)) {
            throw new NamespaceNotFoundException();
        }
    }
}
