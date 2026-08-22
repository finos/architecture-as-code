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
import org.finos.calm.store.github.util.InMemoryRegistryService;

import java.util.Collections;
import java.util.List;

@ApplicationScoped
@Typed(GitHubTimelineStore.class)
public class GitHubTimelineStore implements TimelineStore {

    private static final String WRITE_UNSUPPORTED =
            "Write operations are not yet available. GitHub account linking and PR creation will be enabled in a future release.";

    private static final String VERSION_UNSUPPORTED =
            "Version history via GitHub API is not yet implemented.";

    private final InMemoryRegistryService registryService;

    @Inject
    public GitHubTimelineStore(InMemoryRegistryService registryService) {
        this.registryService = registryService;
    }

    @Override
    public List<NamespaceTimelineSummary> getTimelinesForNamespace(String namespace) throws NamespaceNotFoundException {
        verifyNamespace(namespace);
        return Collections.emptyList();
    }

    @Override
    public Timeline createTimelineForNamespace(CreateTimelineRequest timelineRequest, String namespace) throws NamespaceNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public List<String> getTimelineVersions(Timeline timeline) throws NamespaceNotFoundException, TimelineNotFoundException {
        throw new GitHubWriteNotSupportedException(VERSION_UNSUPPORTED);
    }

    @Override
    public String getTimelineForVersion(Timeline timeline) throws NamespaceNotFoundException, TimelineNotFoundException, TimelineVersionNotFoundException {
        throw new GitHubWriteNotSupportedException(VERSION_UNSUPPORTED);
    }

    @Override
    public Timeline createTimelineForVersion(Timeline timeline) throws NamespaceNotFoundException, TimelineNotFoundException, TimelineVersionExistsException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public Timeline updateTimelineForVersion(Timeline timeline) throws NamespaceNotFoundException, TimelineNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    private void verifyNamespace(String namespace) throws NamespaceNotFoundException {
        if (!registryService.getSnapshot().getNamespaces().contains(namespace)) {
            throw new NamespaceNotFoundException();
        }
    }
}
