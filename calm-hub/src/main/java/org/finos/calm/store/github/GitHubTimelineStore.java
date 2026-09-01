package org.finos.calm.store.github;

import org.finos.calm.domain.exception.GitHubWriteNotSupportedException;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.TimelineNotFoundException;
import org.finos.calm.domain.exception.TimelineVersionExistsException;
import org.finos.calm.domain.exception.TimelineVersionNotFoundException;
import org.finos.calm.domain.timeline.CreateTimelineRequest;
import org.finos.calm.domain.timeline.NamespaceTimelineSummary;
import org.finos.calm.domain.timeline.Timeline;
import org.finos.calm.store.TimelineStore;
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
@Typed(GitHubTimelineStore.class)
public class GitHubTimelineStore implements TimelineStore {

    private static final String WRITE_UNSUPPORTED =
            "Write operations are not yet available. GitHub account linking and PR creation will be enabled in a future release.";

    private static final Logger LOG = LoggerFactory.getLogger(GitHubTimelineStore.class);

    private final InMemoryRegistryService registryService;

    @Inject
    @ConfigProperty(name = "calm.github.clone-directory", defaultValue = "/tmp/calm-hub-clones")
    String cloneDirectory;

    @Inject
    GitHubCloneManager cloneManager;

    @Inject
    GitHubVersionService versionService;

    @Inject
    public GitHubTimelineStore(InMemoryRegistryService registryService) {
        this.registryService = registryService;
    }

    @Override
    public List<NamespaceTimelineSummary> getTimelinesForNamespace(String namespace) throws NamespaceNotFoundException {
        verifyNamespace(namespace);
        List<RegistryEntry> entries = registryService.listByType(namespace, CalmResourceType.TIMELINE);
        return entries.stream()
                .map(e -> new NamespaceTimelineSummary(e.name(), e.uniqueId(), (e.uniqueId().hashCode() & 0x7FFFFFFF)))
                .toList();
    }

    @Override
    public Timeline createTimelineForNamespace(CreateTimelineRequest timelineRequest, String namespace) throws NamespaceNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public List<String> getTimelineVersions(Timeline timeline) throws NamespaceNotFoundException, TimelineNotFoundException {
        verifyNamespace(timeline.getNamespace());
        RegistryEntry entry = findEntryById(timeline.getNamespace(), timeline.getId());
        String repo = cloneManager != null ? cloneManager.getRepoForNamespace(timeline.getNamespace()) : null;
        if (repo != null && versionService != null) {
            return versionService.getFileVersions(repo, entry.filePath().toString());
        }
        return List.of("latest");
    }

    @Override
    public String getTimelineForVersion(Timeline timeline) throws NamespaceNotFoundException, TimelineNotFoundException, TimelineVersionNotFoundException {
        verifyNamespace(timeline.getNamespace());
        RegistryEntry entry = findEntryById(timeline.getNamespace(), timeline.getId());
        String version = timeline.getDotVersion();

        // If a specific SHA is requested and version service is available, fetch from GitHub API
        if (version != null && !version.equals("latest") && version.matches("[0-9a-f]{7,40}")
                && cloneManager != null && versionService != null) {
            String repo = cloneManager.getRepoForNamespace(timeline.getNamespace());
            if (repo != null) {
                String content = versionService.getFileAtVersion(repo, entry.filePath().toString(), version);
                if (content != null) {
                    return content;
                }
            }
        }

        // Fallback: read from local clone (latest/HEAD)
        try {
            Path filePath = Path.of(cloneDirectory, timeline.getNamespace()).resolve(entry.filePath());
            return Files.readString(filePath);
        } catch (IOException e) {
            LOG.error("Failed to read timeline file: {}", entry.filePath(), e);
            throw new TimelineVersionNotFoundException();
        }
    }

    @Override
    public Timeline createTimelineForVersion(Timeline timeline) throws NamespaceNotFoundException, TimelineNotFoundException, TimelineVersionExistsException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public Timeline updateTimelineForVersion(Timeline timeline) throws NamespaceNotFoundException, TimelineNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    private RegistryEntry findEntryById(String namespace, int id) throws TimelineNotFoundException {
        List<RegistryEntry> entries = registryService.listByType(namespace, CalmResourceType.TIMELINE);
        Optional<RegistryEntry> found = entries.stream()
                .filter(e -> (e.uniqueId().hashCode() & 0x7FFFFFFF) == id)
                .findFirst();
        if (found.isEmpty()) {
            throw new TimelineNotFoundException();
        }
        return found.get();
    }

    private void verifyNamespace(String namespace) throws NamespaceNotFoundException {
        if (!registryService.getSnapshot().getNamespaces().contains(namespace)) {
            throw new NamespaceNotFoundException();
        }
    }
}
