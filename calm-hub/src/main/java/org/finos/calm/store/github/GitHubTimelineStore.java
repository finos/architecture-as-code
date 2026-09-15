package org.finos.calm.store.github;

import org.finos.calm.domain.exception.GitHubWriteNotSupportedException;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.TimelineNotFoundException;
import org.finos.calm.domain.exception.TimelineVersionExistsException;
import org.finos.calm.domain.exception.TimelineVersionNotFoundException;
import org.finos.calm.domain.timeline.CreateTimelineRequest;
import org.finos.calm.domain.timeline.NamespaceTimelineSummary;
import org.finos.calm.domain.timeline.Timeline;
import org.finos.calm.store.TimelineStore;
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
 * GitHub-mode {@link TimelineStore}: timelines are read from the {@code .json} files under
 * {@code timelines/} in the namespace's clone, classified into the registry by
 * {@link org.finos.calm.store.github.registry.CalmContentDetector}. Id lookup, version listing
 * and version-content resolution all delegate to {@link AbstractReadOnlyGitHubStore} - see its
 * class javadoc for why an unresolvable version 404s rather than silently reading whatever
 * HEAD holds. Every mutating method throws {@link GitHubWriteNotSupportedException}: this
 * backend is read-only until GitHub account linking and PR creation land.
 */
@ApplicationScoped
@Typed(GitHubTimelineStore.class)
public class GitHubTimelineStore extends AbstractReadOnlyGitHubStore implements TimelineStore {

    private static final Logger LOG = LoggerFactory.getLogger(GitHubTimelineStore.class);

    @Inject
    public GitHubTimelineStore(ResourceRegistry registryService, GitHubCloneManager cloneManager,
                                GitHubFileHistoryClient versionService, NamespaceFileReader fileReader) {
        super(registryService, cloneManager, versionService, fileReader);
    }

    @Override
    public List<NamespaceTimelineSummary> getTimelinesForNamespace(String namespace) throws NamespaceNotFoundException {
        verifyNamespace(namespace);
        List<RegistryEntry> entries = registryService.listByType(namespace, RegistryResourceType.TIMELINE);
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
        RegistryEntry entry = findEntry(timeline.getNamespace(), RegistryResourceType.TIMELINE, timeline.getId())
                .orElseThrow(TimelineNotFoundException::new);
        return getVersions(timeline.getNamespace(), entry);
    }

    @Override
    public String getTimelineForVersion(Timeline timeline) throws NamespaceNotFoundException, TimelineNotFoundException, TimelineVersionNotFoundException {
        verifyNamespace(timeline.getNamespace());
        RegistryEntry entry = findEntry(timeline.getNamespace(), RegistryResourceType.TIMELINE, timeline.getId())
                .orElseThrow(TimelineNotFoundException::new);
        try {
            return readAtVersion(timeline.getNamespace(), entry, timeline.getDotVersion())
                    .orElseThrow(TimelineVersionNotFoundException::new);
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

    @Override
    public void deleteTimeline(String namespace, int timelineId) throws NamespaceNotFoundException, TimelineNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }
}
