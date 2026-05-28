package org.finos.calm.mcp.tools;

import io.quarkiverse.mcp.server.TextContent;
import io.quarkiverse.mcp.server.ToolResponse;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.TimelineNotFoundException;
import org.finos.calm.domain.exception.TimelineVersionExistsException;
import org.finos.calm.domain.exception.TimelineVersionNotFoundException;
import org.finos.calm.domain.timeline.NamespaceTimelineSummary;
import org.finos.calm.domain.timeline.Timeline;
import org.finos.calm.store.TimelineStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestTimelineToolsShould {

    @Mock
    TimelineStore timelineStore;

    @InjectMocks
    TimelineTools timelineTools;

    @BeforeEach
    void setup() {
        timelineTools.mcpEnabled = true;
        timelineTools.allowPutOperations = true;
    }

    private static String text(ToolResponse r) {
        return ((TextContent) r.firstContent()).text();
    }

    // --- listTimelines ---

    @Test
    void return_timelines_when_namespace_has_entries() throws NamespaceNotFoundException {
        when(timelineStore.getTimelinesForNamespace("workshop"))
                .thenReturn(List.of(new NamespaceTimelineSummary("Conference Timeline", "A conference signup timeline", 1)));

        ToolResponse result = timelineTools.listTimelines("workshop");

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("workshop"));
        assertThat(text(result), containsString("Conference Timeline"));
        assertThat(text(result), containsString("ID: 1"));
    }

    @Test
    void return_no_timelines_message_for_empty_namespace() throws NamespaceNotFoundException {
        when(timelineStore.getTimelinesForNamespace("empty"))
                .thenReturn(List.of());

        ToolResponse result = timelineTools.listTimelines("empty");

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("No timelines found"));
    }

    @Test
    void return_error_for_nonexistent_namespace_on_list() throws NamespaceNotFoundException {
        when(timelineStore.getTimelinesForNamespace("missing"))
                .thenThrow(new NamespaceNotFoundException());

        ToolResponse result = timelineTools.listTimelines("missing");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   ", "bad namespace", "bad/ns"})
    void reject_invalid_namespace_for_list_timelines(String namespace) {
        ToolResponse result = timelineTools.listTimelines(namespace);

        assertThat(result.isError(), is(true));
        verifyNoInteractions(timelineStore);
    }

    @Test
    void return_error_when_mcp_disabled_for_list_timelines() {
        timelineTools.mcpEnabled = false;

        ToolResponse result = timelineTools.listTimelines("workshop");

        assertThat(result.isError(), is(true));
        verifyNoInteractions(timelineStore);
    }

    // --- listTimelineVersions ---

    @Test
    void return_versions_for_valid_timeline() throws Exception {
        when(timelineStore.getTimelineVersions(any()))
                .thenReturn(List.of("1.0.0", "2.0.0"));

        ToolResponse result = timelineTools.listTimelineVersions("workshop", 1);

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("1.0.0"));
        assertThat(text(result), containsString("2.0.0"));
    }

    @Test
    void return_empty_versions_message() throws Exception {
        when(timelineStore.getTimelineVersions(any()))
                .thenReturn(List.of());

        ToolResponse result = timelineTools.listTimelineVersions("workshop", 1);

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("No versions found"));
    }

    @Test
    void return_error_when_timeline_not_found_for_versions() throws Exception {
        when(timelineStore.getTimelineVersions(any()))
                .thenThrow(new TimelineNotFoundException());

        ToolResponse result = timelineTools.listTimelineVersions("workshop", 99);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    @Test
    void return_error_when_namespace_not_found_for_versions() throws Exception {
        when(timelineStore.getTimelineVersions(any()))
                .thenThrow(new NamespaceNotFoundException());

        ToolResponse result = timelineTools.listTimelineVersions("missing", 1);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Namespace"));
    }

    @Test
    void reject_invalid_namespace_for_list_versions() {
        ToolResponse result = timelineTools.listTimelineVersions("bad ns", 1);

        assertThat(result.isError(), is(true));
        verifyNoInteractions(timelineStore);
    }

    @Test
    void reject_non_positive_timeline_id_for_list_versions() {
        ToolResponse result = timelineTools.listTimelineVersions("workshop", 0);

        assertThat(result.isError(), is(true));
        verifyNoInteractions(timelineStore);
    }

    // --- getTimeline ---

    @Test
    void return_timeline_json_for_valid_version() throws Exception {
        when(timelineStore.getTimelineForVersion(any()))
                .thenReturn("{\"events\":[]}");

        ToolResponse result = timelineTools.getTimeline("workshop", 1, "1.0.0");

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("events"));
    }

    @Test
    void return_error_when_timeline_version_not_found() throws Exception {
        when(timelineStore.getTimelineForVersion(any()))
                .thenThrow(new TimelineVersionNotFoundException());

        ToolResponse result = timelineTools.getTimeline("workshop", 1, "9.9.9");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Version"));
    }

    @Test
    void return_error_when_namespace_not_found_for_get() throws Exception {
        when(timelineStore.getTimelineForVersion(any()))
                .thenThrow(new NamespaceNotFoundException());

        ToolResponse result = timelineTools.getTimeline("missing", 1, "1.0.0");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Namespace"));
    }

    @Test
    void return_error_when_timeline_not_found_for_get() throws Exception {
        when(timelineStore.getTimelineForVersion(any()))
                .thenThrow(new TimelineNotFoundException());

        ToolResponse result = timelineTools.getTimeline("workshop", 99, "1.0.0");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    @Test
    void reject_invalid_namespace_for_get_timeline() {
        ToolResponse result = timelineTools.getTimeline("bad ns", 1, "1.0.0");

        assertThat(result.isError(), is(true));
        verifyNoInteractions(timelineStore);
    }

    @Test
    void reject_invalid_version_for_get_timeline() {
        ToolResponse result = timelineTools.getTimeline("workshop", 1, "not-a-version");

        assertThat(result.isError(), is(true));
        verifyNoInteractions(timelineStore);
    }

    @Test
    void reject_non_positive_timeline_id_for_get_timeline() {
        ToolResponse result = timelineTools.getTimeline("workshop", -1, "1.0.0");

        assertThat(result.isError(), is(true));
        verifyNoInteractions(timelineStore);
    }

    // --- createTimeline ---

    @Test
    void create_timeline_successfully() throws NamespaceNotFoundException {
        Timeline returnedTimeline = new Timeline.TimelineBuilder()
                .setNamespace("workshop")
                .setId(42)
                .setVersion("1.0.0")
                .build();
        when(timelineStore.createTimelineForNamespace(any(), any()))
                .thenReturn(returnedTimeline);

        ToolResponse result = timelineTools.createTimeline("workshop", "My Timeline", "A description", "{\"events\":[]}");

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("ID: 42"));
        assertThat(text(result), containsString("version 1.0.0"));
        assertThat(text(result), containsString("workshop"));
    }

    @Test
    void return_error_when_creating_timeline_in_missing_namespace() throws NamespaceNotFoundException {
        when(timelineStore.createTimelineForNamespace(any(), any()))
                .thenThrow(new NamespaceNotFoundException());

        ToolResponse result = timelineTools.createTimeline("missing", "My Timeline", "desc", "{}");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    @Test
    void return_error_for_invalid_timeline_json_on_create() {
        ToolResponse result = timelineTools.createTimeline("workshop", "My Timeline", "desc", "not-json");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Invalid"));
        verifyNoInteractions(timelineStore);
    }

    @Test
    void reject_invalid_namespace_for_create_timeline() {
        ToolResponse result = timelineTools.createTimeline("bad ns", "name", "desc", "{}");

        assertThat(result.isError(), is(true));
        verifyNoInteractions(timelineStore);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   "})
    void reject_blank_json_for_create_timeline(String json) {
        ToolResponse result = timelineTools.createTimeline("workshop", "name", "desc", json);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Timeline JSON"));
        verifyNoInteractions(timelineStore);
    }

    @Test
    void reject_timeline_name_exceeding_max_length() {
        String longName = "n".repeat(201);
        ToolResponse result = timelineTools.createTimeline("workshop", longName, "desc", "{}");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Timeline name"));
        verifyNoInteractions(timelineStore);
    }

    @Test
    void reject_timeline_description_exceeding_max_length() {
        String longDesc = "d".repeat(1025);
        ToolResponse result = timelineTools.createTimeline("workshop", "name", longDesc, "{}");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Timeline description"));
        verifyNoInteractions(timelineStore);
    }

    @Test
    void reject_timeline_json_exceeding_max_payload_on_create() {
        String huge = "{\"x\":\"" + "a".repeat(100_001) + "\"}";

        ToolResponse result = timelineTools.createTimeline("workshop", "name", "desc", huge);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Timeline JSON"));
        verifyNoInteractions(timelineStore);
    }

    // --- createTimelineVersion ---

    @Test
    void create_timeline_version_successfully() throws Exception {
        ToolResponse result = timelineTools.createTimelineVersion("workshop", 1, "1.1.0", "{\"events\":[]}");

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("1"));
        assertThat(text(result), containsString("1.1.0"));
        assertThat(text(result), containsString("workshop"));
    }

    @Test
    void create_timeline_version_succeeds_when_put_operations_disabled() throws Exception {
        // Publishing a new version is a POST — must work without allowPutOperations
        timelineTools.allowPutOperations = false;

        ToolResponse result = timelineTools.createTimelineVersion("workshop", 1, "1.1.0", "{\"events\":[]}");

        assertThat(result.isError(), is(false));
    }

    @Test
    void create_timeline_version_returns_error_for_duplicate_version() throws Exception {
        org.mockito.Mockito.doThrow(new TimelineVersionExistsException())
                .when(timelineStore).createTimelineForVersion(any());

        ToolResponse result = timelineTools.createTimelineVersion("workshop", 1, "1.1.0", "{\"events\":[]}");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("already exists"));
    }

    @Test
    void create_timeline_version_returns_error_for_missing_namespace() throws Exception {
        org.mockito.Mockito.doThrow(new NamespaceNotFoundException())
                .when(timelineStore).createTimelineForVersion(any());

        ToolResponse result = timelineTools.createTimelineVersion("missing", 1, "1.1.0", "{\"events\":[]}");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Namespace"));
    }

    @Test
    void create_timeline_version_returns_error_for_missing_timeline() throws Exception {
        org.mockito.Mockito.doThrow(new TimelineNotFoundException())
                .when(timelineStore).createTimelineForVersion(any());

        ToolResponse result = timelineTools.createTimelineVersion("workshop", 99, "1.1.0", "{\"events\":[]}");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    @Test
    void create_timeline_version_rejects_invalid_version_string() {
        ToolResponse result = timelineTools.createTimelineVersion("workshop", 1, "not-a-version", "{\"events\":[]}");

        assertThat(result.isError(), is(true));
        verifyNoInteractions(timelineStore);
    }

    @Test
    void create_timeline_version_rejects_invalid_json() {
        ToolResponse result = timelineTools.createTimelineVersion("workshop", 1, "1.1.0", "not-json");

        assertThat(result.isError(), is(true));
        verifyNoInteractions(timelineStore);
    }

    @Test
    void create_timeline_version_rejects_json_exceeding_max_payload() {
        String huge = "{\"x\":\"" + "a".repeat(100_001) + "\"}";

        ToolResponse result = timelineTools.createTimelineVersion("workshop", 1, "1.1.0", huge);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Timeline JSON"));
        verifyNoInteractions(timelineStore);
    }

    // --- updateTimeline (PUT — requires allowPutOperations) ---

    @Test
    void update_timeline_version_successfully() throws Exception {
        ToolResponse result = timelineTools.updateTimeline("workshop", 1, "1.0.0", "{\"events\":[]}");

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("1"));
        assertThat(text(result), containsString("1.0.0"));
        assertThat(text(result), containsString("workshop"));
    }

    @Test
    void return_error_when_put_operations_disabled_for_update_timeline() {
        timelineTools.allowPutOperations = false;

        ToolResponse result = timelineTools.updateTimeline("workshop", 1, "1.0.0", "{}");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("allow.put.operations"));
        verifyNoInteractions(timelineStore);
    }

    @Test
    void return_error_when_namespace_not_found_for_update() throws Exception {
        org.mockito.Mockito.doThrow(new NamespaceNotFoundException())
                .when(timelineStore).updateTimelineForVersion(any());

        ToolResponse result = timelineTools.updateTimeline("missing", 1, "1.0.0", "{\"events\":[]}");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Namespace"));
    }

    @Test
    void return_error_when_timeline_not_found_for_update() throws Exception {
        org.mockito.Mockito.doThrow(new TimelineNotFoundException())
                .when(timelineStore).updateTimelineForVersion(any());

        ToolResponse result = timelineTools.updateTimeline("workshop", 99, "1.0.0", "{\"events\":[]}");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    @Test
    void reject_update_timeline_json_exceeding_max_payload() {
        String huge = "{\"x\":\"" + "a".repeat(100_001) + "\"}";

        ToolResponse result = timelineTools.updateTimeline("workshop", 1, "1.0.0", huge);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Timeline JSON"));
        verifyNoInteractions(timelineStore);
    }

    @Test
    void reject_invalid_version_for_update_timeline() {
        ToolResponse result = timelineTools.updateTimeline("workshop", 1, "not-a-version", "{}");

        assertThat(result.isError(), is(true));
        verifyNoInteractions(timelineStore);
    }

    @Test
    void reject_invalid_namespace_for_update_timeline() {
        ToolResponse result = timelineTools.updateTimeline("bad ns", 1, "1.0.0", "{}");

        assertThat(result.isError(), is(true));
        verifyNoInteractions(timelineStore);
    }

    @Test
    void reject_blank_json_for_update_timeline() {
        ToolResponse result = timelineTools.updateTimeline("workshop", 1, "1.0.0", "");

        assertThat(result.isError(), is(true));
        verifyNoInteractions(timelineStore);
    }

    @Test
    void reject_non_positive_id_for_update_timeline() {
        ToolResponse result = timelineTools.updateTimeline("workshop", 0, "1.0.0", "{}");

        assertThat(result.isError(), is(true));
        verifyNoInteractions(timelineStore);
    }
}
