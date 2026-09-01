package org.finos.calm.store.github;

import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.TimelineNotFoundException;
import org.finos.calm.domain.exception.TimelineVersionNotFoundException;
import org.finos.calm.domain.timeline.CreateTimelineRequest;
import org.finos.calm.domain.timeline.NamespaceTimelineSummary;
import org.finos.calm.domain.timeline.Timeline;
import org.finos.calm.store.github.util.CalmResourceType;
import org.finos.calm.store.github.util.GitHubCloneManager;
import org.finos.calm.store.github.util.GitHubVersionService;
import org.finos.calm.store.github.util.InMemoryRegistryService;
import org.finos.calm.store.github.util.RegistryEntry;
import org.finos.calm.store.github.util.RegistrySnapshot;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestGitHubTimelineStoreShould {

    @Mock
    private InMemoryRegistryService registryService;

    private GitHubTimelineStore store;

    @BeforeEach
    void setup() {
        store = new GitHubTimelineStore(registryService);
    }

    @Test
    void return_empty_timelines_for_namespace() throws NamespaceNotFoundException {
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of()),
                Map.of(),
                Map.of()
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", CalmResourceType.TIMELINE)).thenReturn(List.of());

        List<NamespaceTimelineSummary> result = store.getTimelinesForNamespace("finos");

        assertThat(result, is(empty()));
    }

    @Test
    void return_timelines_for_namespace() throws NamespaceNotFoundException {
        RegistryEntry entry = new RegistryEntry("release-timeline", Path.of("timelines/release-timeline.json"),
                CalmResourceType.TIMELINE, "Release Timeline", Instant.now());

        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:release-timeline", entry),
                Map.of(CalmResourceType.TIMELINE, List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", CalmResourceType.TIMELINE)).thenReturn(List.of(entry));

        List<NamespaceTimelineSummary> result = store.getTimelinesForNamespace("finos");

        assertThat(result, hasSize(1));
        assertThat(result.get(0).getName(), equalTo("Release Timeline"));
    }

    @Test
    void throw_namespace_not_found_when_namespace_missing() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.getTimelinesForNamespace("nonexistent"));
    }

    @Test
    void throw_unsupported_on_create_timeline() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.createTimelineForNamespace(new CreateTimelineRequest(), "finos"));
    }

    @Test
    void throw_namespace_not_found_on_get_timeline_versions() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);
        assertThrows(NamespaceNotFoundException.class,
                () -> store.getTimelineVersions(new Timeline.TimelineBuilder().setNamespace("nonexistent").build()));
    }

    @Test
    void throw_namespace_not_found_on_get_timeline_for_version() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);
        assertThrows(NamespaceNotFoundException.class,
                () -> store.getTimelineForVersion(new Timeline.TimelineBuilder().setNamespace("nonexistent").build()));
    }

    @Test
    void return_versions_list_for_existing_timeline() throws Exception {
        RegistryEntry entry = new RegistryEntry("release-timeline", Path.of("timelines/release-timeline.json"),
                CalmResourceType.TIMELINE, "Release Timeline", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:release-timeline", entry),
                Map.of(CalmResourceType.TIMELINE, List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", CalmResourceType.TIMELINE)).thenReturn(List.of(entry));

        int hashId = ("release-timeline".hashCode() & 0x7FFFFFFF);
        Timeline timeline = new Timeline.TimelineBuilder().setNamespace("finos").setId(hashId).build();
        List<String> versions = store.getTimelineVersions(timeline);

        assertThat(versions, hasSize(1));
        assertThat(versions.get(0), equalTo("latest"));
    }

    @Test
    void return_sha_versions_when_version_service_available() throws Exception {
        RegistryEntry entry = new RegistryEntry("release-timeline", Path.of("timelines/release-timeline.json"),
                CalmResourceType.TIMELINE, "Release Timeline", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:release-timeline", entry),
                Map.of(CalmResourceType.TIMELINE, List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", CalmResourceType.TIMELINE)).thenReturn(List.of(entry));

        GitHubCloneManager mockCloneManager = Mockito.mock(GitHubCloneManager.class);
        GitHubVersionService mockVersionService = Mockito.mock(GitHubVersionService.class);
        store.cloneManager = mockCloneManager;
        store.versionService = mockVersionService;

        when(mockCloneManager.getRepoForNamespace("finos")).thenReturn("finos/architecture-as-code");
        when(mockVersionService.getFileVersions("finos/architecture-as-code", "timelines/release-timeline.json"))
                .thenReturn(List.of("abc1234", "def5678"));

        int hashId = ("release-timeline".hashCode() & 0x7FFFFFFF);
        Timeline timeline = new Timeline.TimelineBuilder().setNamespace("finos").setId(hashId).build();
        List<String> versions = store.getTimelineVersions(timeline);

        assertThat(versions, hasSize(2));
        assertThat(versions.get(0), equalTo("abc1234"));
    }

    @Test
    void return_timeline_content_for_version(@TempDir Path tempDir) throws Exception {
        Path timelineDir = tempDir.resolve("finos/timelines");
        Files.createDirectories(timelineDir);
        Files.writeString(timelineDir.resolve("release-timeline.json"), "{\"milestones\":[]}");

        RegistryEntry entry = new RegistryEntry("release-timeline", Path.of("timelines/release-timeline.json"),
                CalmResourceType.TIMELINE, "Release Timeline", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:release-timeline", entry),
                Map.of(CalmResourceType.TIMELINE, List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", CalmResourceType.TIMELINE)).thenReturn(List.of(entry));

        store.cloneDirectory = tempDir.toString();
        int hashId = ("release-timeline".hashCode() & 0x7FFFFFFF);
        Timeline timeline = new Timeline.TimelineBuilder().setNamespace("finos").setId(hashId).setVersion("1.0.0").build();

        String content = store.getTimelineForVersion(timeline);
        assertThat(content, equalTo("{\"milestones\":[]}"));
    }

    @Test
    void return_content_from_github_api_for_sha_version() throws Exception {
        RegistryEntry entry = new RegistryEntry("release-timeline", Path.of("timelines/release-timeline.json"),
                CalmResourceType.TIMELINE, "Release Timeline", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:release-timeline", entry),
                Map.of(CalmResourceType.TIMELINE, List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", CalmResourceType.TIMELINE)).thenReturn(List.of(entry));

        GitHubCloneManager mockCloneManager = Mockito.mock(GitHubCloneManager.class);
        GitHubVersionService mockVersionService = Mockito.mock(GitHubVersionService.class);
        store.cloneManager = mockCloneManager;
        store.versionService = mockVersionService;

        when(mockCloneManager.getRepoForNamespace("finos")).thenReturn("finos/repo");
        when(mockVersionService.getFileAtVersion("finos/repo", "timelines/release-timeline.json", "abc1234"))
                .thenReturn("{\"milestones\":[{\"name\":\"old\"}]}");

        int hashId = ("release-timeline".hashCode() & 0x7FFFFFFF);
        Timeline timeline = new Timeline.TimelineBuilder().setNamespace("finos").setId(hashId).setVersion("abc1234").build();
        String content = store.getTimelineForVersion(timeline);

        assertThat(content, equalTo("{\"milestones\":[{\"name\":\"old\"}]}"));
    }

    @Test
    void throw_timeline_not_found_when_id_does_not_match() {
        RegistryEntry entry = new RegistryEntry("release-timeline", Path.of("timelines/release-timeline.json"),
                CalmResourceType.TIMELINE, "Release Timeline", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:release-timeline", entry),
                Map.of(CalmResourceType.TIMELINE, List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", CalmResourceType.TIMELINE)).thenReturn(List.of(entry));

        Timeline timeline = new Timeline.TimelineBuilder().setNamespace("finos").setId(99999).build();
        assertThrows(TimelineNotFoundException.class, () -> store.getTimelineVersions(timeline));
    }

    @Test
    void throw_unsupported_on_create_timeline_for_version() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.createTimelineForVersion(new Timeline.TimelineBuilder().build()));
    }

    @Test
    void throw_unsupported_on_update_timeline_for_version() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.updateTimelineForVersion(new Timeline.TimelineBuilder().build()));
    }
}
