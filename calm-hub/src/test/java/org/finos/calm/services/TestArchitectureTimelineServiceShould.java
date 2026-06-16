package org.finos.calm.services;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.finos.calm.domain.Architecture;
import org.finos.calm.domain.exception.ArchitectureNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.TimelineNotFoundException;
import org.finos.calm.domain.timeline.NamespaceTimelineSummary;
import org.finos.calm.domain.timeline.Timeline;
import org.finos.calm.store.ArchitectureStore;
import org.finos.calm.store.TimelineStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class TestArchitectureTimelineServiceShould {

    @Mock
    private ArchitectureStore mockArchitectureStore;

    @Mock
    private TimelineStore mockTimelineStore;

    private ArchitectureTimelineService service;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final String NAMESPACE = "finos";
    private static final int ARCHITECTURE_ID = 42;

    @BeforeEach
    void setup() {
        service = new ArchitectureTimelineService(mockArchitectureStore, mockTimelineStore);
    }

    // No stored timeline references the architecture -> the implied projection is produced.
    private JsonNode impliedTimelineFor(List<String> versions) throws Exception {
        when(mockTimelineStore.getTimelinesForNamespace(NAMESPACE)).thenReturn(List.of());
        when(mockArchitectureStore.getArchitectureVersions(any(Architecture.class))).thenReturn(versions);
        return objectMapper.readTree(service.getTimelineForArchitecture(NAMESPACE, ARCHITECTURE_ID));
    }

    private String explicitTimelineReferencing(String architecturePath) {
        return "{\"$schema\":\"" + ArchitectureTimelineService.TIMELINE_SCHEMA + "\","
                + "\"current-moment\":\"go-live\",\"moments\":[{"
                + "\"unique-id\":\"go-live\",\"node-type\":\"moment\",\"name\":\"Risk go-live\","
                + "\"description\":\"curated\",\"details\":{\"detailed-architecture\":\"" + architecturePath + "\"}}]}";
    }

    @Test
    void produce_a_timeline_with_no_moments_when_no_versions_exist() throws Exception {
        JsonNode timeline = impliedTimelineFor(List.of());

        assertThat(timeline.get("$schema").asText(), is(ArchitectureTimelineService.TIMELINE_SCHEMA));
        assertThat(timeline.get("moments").size(), is(0));
        // current-moment must be omitted when there are no moments
        assertThat(timeline.has("current-moment"), is(false));
    }

    @Test
    void produce_a_single_moment_for_a_single_version() throws Exception {
        JsonNode timeline = impliedTimelineFor(List.of("1.0.0"));

        assertThat(timeline.get("$schema").asText(), is(ArchitectureTimelineService.TIMELINE_SCHEMA));
        assertThat(timeline.get("current-moment").asText(), is("1.0.0"));

        JsonNode moments = timeline.get("moments");
        assertThat(moments.size(), is(1));

        JsonNode moment = moments.get(0);
        assertThat(moment.get("unique-id").asText(), is("1.0.0"));
        assertThat(moment.get("node-type").asText(), is("moment"));
        assertThat(moment.get("name").asText(), is("1.0.0"));
        assertThat(moment.get("description").asText(), containsString("1.0.0"));
        assertThat(moment.get("details").get("detailed-architecture").asText(),
                is("/api/calm/namespaces/finos/architectures/42/versions/1.0.0"));
    }

    @Test
    void order_multiple_semver_versions_ascending_and_set_current_moment_to_highest() throws Exception {
        // Deliberately unsorted input
        JsonNode timeline = impliedTimelineFor(List.of("2.0.0", "1.0.0", "1.1.0", "1.0.1"));

        JsonNode moments = timeline.get("moments");
        assertThat(moments.size(), is(4));
        assertThat(moments.get(0).get("unique-id").asText(), is("1.0.0"));
        assertThat(moments.get(1).get("unique-id").asText(), is("1.0.1"));
        assertThat(moments.get(2).get("unique-id").asText(), is("1.1.0"));
        assertThat(moments.get(3).get("unique-id").asText(), is("2.0.0"));
        assertThat(timeline.get("current-moment").asText(), is("2.0.0"));
    }

    @Test
    void include_a_moment_per_version_for_duplicate_versions() throws Exception {
        JsonNode timeline = impliedTimelineFor(List.of("1.0.0", "1.0.0"));

        JsonNode moments = timeline.get("moments");
        assertThat(moments.size(), is(2));
        assertThat(moments.get(0).get("unique-id").asText(), is("1.0.0"));
        assertThat(moments.get(1).get("unique-id").asText(), is("1.0.0"));
        assertThat(timeline.get("current-moment").asText(), is("1.0.0"));
    }

    @Test
    void append_non_semver_versions_after_semver_versions_in_storage_order() throws Exception {
        // semver and non-semver mixed; non-semver in a specific storage order
        JsonNode timeline = impliedTimelineFor(List.of("draft-b", "2.0.0", "draft-a", "1.0.0"));

        JsonNode moments = timeline.get("moments");
        assertThat(moments.size(), is(4));
        // semver ascending first
        assertThat(moments.get(0).get("unique-id").asText(), is("1.0.0"));
        assertThat(moments.get(1).get("unique-id").asText(), is("2.0.0"));
        // non-semver appended in original storage order (draft-b before draft-a)
        assertThat(moments.get(2).get("unique-id").asText(), is("draft-b"));
        assertThat(moments.get(3).get("unique-id").asText(), is("draft-a"));
        // current-moment is the last in order (a non-semver version here)
        assertThat(timeline.get("current-moment").asText(), is("draft-a"));
    }

    @Test
    void treat_only_non_semver_versions_in_storage_order() throws Exception {
        JsonNode timeline = impliedTimelineFor(List.of("alpha", "beta"));

        JsonNode moments = timeline.get("moments");
        assertThat(moments.size(), is(2));
        assertThat(moments.get(0).get("unique-id").asText(), is("alpha"));
        assertThat(moments.get(1).get("unique-id").asText(), is("beta"));
        assertThat(timeline.get("current-moment").asText(), is("beta"));
    }

    @Test
    void treat_hyphenated_semver_as_semver() throws Exception {
        // Semver.parse accepts hyphen-separated versions (e.g. mongo-style "1-0-0")
        JsonNode timeline = impliedTimelineFor(List.of("2-0-0", "1-0-0"));

        JsonNode moments = timeline.get("moments");
        assertThat(moments.size(), is(2));
        assertThat(moments.get(0).get("unique-id").asText(), is("1-0-0"));
        assertThat(moments.get(1).get("unique-id").asText(), is("2-0-0"));
        assertThat(timeline.get("current-moment").asText(), is("2-0-0"));
    }

    @Test
    void match_the_calm_timeline_document_shape() throws Exception {
        JsonNode timeline = impliedTimelineFor(List.of("1.0.0", "1.1.0"));

        // Top-level required fields per calm-timeline.json shape
        assertThat(timeline.has("$schema"), is(true));
        assertThat(timeline.has("current-moment"), is(true));
        assertThat(timeline.has("moments"), is(true));
        assertThat(timeline.get("current-moment").asText(), is("1.1.0"));

        for (JsonNode moment : timeline.get("moments")) {
            assertThat(moment.has("unique-id"), is(true));
            assertThat(moment.get("node-type").asText(), is("moment"));
            assertThat(moment.has("name"), is(true));
            assertThat(moment.has("description"), is(true));
            assertThat(moment.get("details").has("detailed-architecture"), is(true));
        }
    }

    @Test
    void return_explicit_timeline_when_a_stored_timeline_references_the_architecture() throws Exception {
        when(mockTimelineStore.getTimelinesForNamespace(NAMESPACE))
                .thenReturn(List.of(new NamespaceTimelineSummary("Trading Timeline", "curated", 7)));
        when(mockTimelineStore.getTimelineVersions(any(Timeline.class))).thenReturn(List.of("1.0.0"));
        when(mockTimelineStore.getTimelineForVersion(any(Timeline.class)))
                .thenReturn(explicitTimelineReferencing("/api/calm/namespaces/finos/architectures/42/versions/1.0.0"));

        JsonNode timeline = objectMapper.readTree(service.getTimelineForArchitecture(NAMESPACE, ARCHITECTURE_ID));

        // The curated (explicit) document is returned, not the implied projection.
        assertThat(timeline.get("current-moment").asText(), is("go-live"));
        assertThat(timeline.get("moments").get(0).get("name").asText(), is("Risk go-live"));
    }

    @Test
    void select_the_latest_version_of_a_matching_explicit_timeline() throws Exception {
        when(mockTimelineStore.getTimelinesForNamespace(NAMESPACE))
                .thenReturn(List.of(new NamespaceTimelineSummary("Trading Timeline", "curated", 7)));
        when(mockTimelineStore.getTimelineVersions(any(Timeline.class))).thenReturn(List.of("1.0.0", "2.0.0", "1.1.0"));
        when(mockTimelineStore.getTimelineForVersion(any(Timeline.class)))
                .thenReturn(explicitTimelineReferencing("/api/calm/namespaces/finos/architectures/42/versions/1.0.0"));

        JsonNode timeline = objectMapper.readTree(service.getTimelineForArchitecture(NAMESPACE, ARCHITECTURE_ID));

        assertThat(timeline.get("current-moment").asText(), is("go-live"));
    }

    @Test
    void ignore_a_stored_timeline_that_references_a_different_architecture() throws Exception {
        when(mockTimelineStore.getTimelinesForNamespace(NAMESPACE))
                .thenReturn(List.of(new NamespaceTimelineSummary("Other Timeline", "curated", 7)));
        when(mockTimelineStore.getTimelineVersions(any(Timeline.class))).thenReturn(List.of("1.0.0"));
        when(mockTimelineStore.getTimelineForVersion(any(Timeline.class)))
                .thenReturn(explicitTimelineReferencing("/calm/namespaces/finos/architectures/99/versions/1.0.0"));
        when(mockArchitectureStore.getArchitectureVersions(any(Architecture.class))).thenReturn(List.of("1.0.0"));

        JsonNode timeline = objectMapper.readTree(service.getTimelineForArchitecture(NAMESPACE, ARCHITECTURE_ID));

        // Implied projection: moment named by version, not the curated name.
        assertThat(timeline.get("moments").get(0).get("name").asText(), is("1.0.0"));
    }

    @Test
    void not_match_on_an_architecture_id_prefix() throws Exception {
        // Architecture 42 must not be matched by a reference to architecture 420.
        when(mockTimelineStore.getTimelinesForNamespace(NAMESPACE))
                .thenReturn(List.of(new NamespaceTimelineSummary("Other Timeline", "curated", 7)));
        when(mockTimelineStore.getTimelineVersions(any(Timeline.class))).thenReturn(List.of("1.0.0"));
        when(mockTimelineStore.getTimelineForVersion(any(Timeline.class)))
                .thenReturn(explicitTimelineReferencing("/calm/namespaces/finos/architectures/420/versions/1.0.0"));
        when(mockArchitectureStore.getArchitectureVersions(any(Architecture.class))).thenReturn(List.of("1.0.0"));

        JsonNode timeline = objectMapper.readTree(service.getTimelineForArchitecture(NAMESPACE, ARCHITECTURE_ID));

        assertThat(timeline.get("moments").get(0).get("name").asText(), is("1.0.0"));
    }

    @Test
    void fall_back_to_implied_when_a_stored_timeline_has_no_versions() throws Exception {
        when(mockTimelineStore.getTimelinesForNamespace(NAMESPACE))
                .thenReturn(List.of(new NamespaceTimelineSummary("Empty Timeline", "curated", 7)));
        when(mockTimelineStore.getTimelineVersions(any(Timeline.class))).thenReturn(List.of());
        when(mockArchitectureStore.getArchitectureVersions(any(Architecture.class))).thenReturn(List.of("1.0.0"));

        JsonNode timeline = objectMapper.readTree(service.getTimelineForArchitecture(NAMESPACE, ARCHITECTURE_ID));

        assertThat(timeline.get("moments").get(0).get("name").asText(), is("1.0.0"));
    }

    @Test
    void skip_a_stored_timeline_whose_version_lookup_fails() throws Exception {
        when(mockTimelineStore.getTimelinesForNamespace(NAMESPACE))
                .thenReturn(List.of(new NamespaceTimelineSummary("Broken Timeline", "curated", 7)));
        when(mockTimelineStore.getTimelineVersions(any(Timeline.class))).thenThrow(new TimelineNotFoundException());
        when(mockArchitectureStore.getArchitectureVersions(any(Architecture.class))).thenReturn(List.of("1.0.0"));

        JsonNode timeline = objectMapper.readTree(service.getTimelineForArchitecture(NAMESPACE, ARCHITECTURE_ID));

        assertThat(timeline.get("moments").get(0).get("name").asText(), is("1.0.0"));
    }

    @Test
    void fall_back_to_implied_when_a_stored_timeline_is_not_valid_json() throws Exception {
        when(mockTimelineStore.getTimelinesForNamespace(NAMESPACE))
                .thenReturn(List.of(new NamespaceTimelineSummary("Corrupt Timeline", "curated", 7)));
        when(mockTimelineStore.getTimelineVersions(any(Timeline.class))).thenReturn(List.of("1.0.0"));
        when(mockTimelineStore.getTimelineForVersion(any(Timeline.class))).thenReturn("this is not json");
        when(mockArchitectureStore.getArchitectureVersions(any(Architecture.class))).thenReturn(List.of("1.0.0"));

        JsonNode timeline = objectMapper.readTree(service.getTimelineForArchitecture(NAMESPACE, ARCHITECTURE_ID));

        assertThat(timeline.get("moments").get(0).get("name").asText(), is("1.0.0"));
    }

    @Test
    void propagate_namespace_not_found_exception() throws Exception {
        when(mockTimelineStore.getTimelinesForNamespace(NAMESPACE)).thenReturn(List.of());
        when(mockArchitectureStore.getArchitectureVersions(any(Architecture.class)))
                .thenThrow(new NamespaceNotFoundException());

        assertThrows(NamespaceNotFoundException.class,
                () -> service.getTimelineForArchitecture(NAMESPACE, ARCHITECTURE_ID));
    }

    @Test
    void propagate_architecture_not_found_exception() throws Exception {
        when(mockTimelineStore.getTimelinesForNamespace(NAMESPACE)).thenReturn(List.of());
        when(mockArchitectureStore.getArchitectureVersions(any(Architecture.class)))
                .thenThrow(new ArchitectureNotFoundException());

        assertThrows(ArchitectureNotFoundException.class,
                () -> service.getTimelineForArchitecture(NAMESPACE, ARCHITECTURE_ID));
    }
}
