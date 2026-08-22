package org.finos.calm.store.github;

import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.timeline.CreateTimelineRequest;
import org.finos.calm.domain.timeline.NamespaceTimelineSummary;
import org.finos.calm.domain.timeline.Timeline;
import org.finos.calm.store.github.util.InMemoryRegistryService;
import org.finos.calm.store.github.util.RegistrySnapshot;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.empty;
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

        List<NamespaceTimelineSummary> result = store.getTimelinesForNamespace("finos");

        assertThat(result, is(empty()));
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
    void throw_unsupported_on_get_timeline_versions() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.getTimelineVersions(new Timeline.TimelineBuilder().build()));
    }

    @Test
    void throw_unsupported_on_get_timeline_for_version() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.getTimelineForVersion(new Timeline.TimelineBuilder().build()));
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
