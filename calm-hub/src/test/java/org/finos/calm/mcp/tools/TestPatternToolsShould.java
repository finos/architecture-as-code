package org.finos.calm.mcp.tools;

import io.quarkiverse.mcp.server.TextContent;
import io.quarkiverse.mcp.server.ToolResponse;
import org.finos.calm.domain.Pattern;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.PatternNotFoundException;
import org.finos.calm.domain.exception.PatternVersionExistsException;
import org.finos.calm.domain.exception.PatternVersionNotFoundException;
import org.finos.calm.domain.pattern.NamespacePatternSummary;
import org.finos.calm.store.PatternStore;
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
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestPatternToolsShould {

    @Mock
    PatternStore patternStore;

    @InjectMocks
    PatternTools patternTools;

    @BeforeEach
    void setup() {
        patternTools.mcpEnabled = true;
    }

    private static String text(ToolResponse r) {
        return ((TextContent) r.firstContent()).text();
    }

    // --- listPatterns ---

    @Test
    void return_patterns_when_namespace_has_entries() throws NamespaceNotFoundException {
        when(patternStore.getPatternsForNamespace("workshop"))
                .thenReturn(List.of(new NamespacePatternSummary("Conference Pattern", "A conference signup pattern", 1)));

        ToolResponse result = patternTools.listPatterns("workshop");

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("workshop"));
        assertThat(text(result), containsString("Conference Pattern"));
        assertThat(text(result), containsString("ID: 1"));
    }

    @Test
    void return_no_patterns_message_for_empty_namespace() throws NamespaceNotFoundException {
        when(patternStore.getPatternsForNamespace("empty")).thenReturn(List.of());

        ToolResponse result = patternTools.listPatterns("empty");

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("No patterns found"));
    }

    @Test
    void return_error_for_nonexistent_namespace_on_list_patterns() throws NamespaceNotFoundException {
        when(patternStore.getPatternsForNamespace("missing")).thenThrow(new NamespaceNotFoundException());

        ToolResponse result = patternTools.listPatterns("missing");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   ", "bad namespace", "bad/ns"})
    void reject_invalid_namespace_for_list_patterns(String namespace) {
        ToolResponse result = patternTools.listPatterns(namespace);

        assertThat(result.isError(), is(true));
        verifyNoInteractions(patternStore);
    }

    // --- listPatternVersions ---

    @Test
    void return_versions_for_valid_pattern() throws Exception {
        when(patternStore.getPatternVersions(any())).thenReturn(List.of("1.0.0", "2.0.0"));

        ToolResponse result = patternTools.listPatternVersions("workshop", 1);

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("1.0.0"));
        assertThat(text(result), containsString("2.0.0"));
    }

    @Test
    void return_empty_versions_message() throws Exception {
        when(patternStore.getPatternVersions(any())).thenReturn(List.of());

        ToolResponse result = patternTools.listPatternVersions("workshop", 1);

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("No versions found"));
    }

    @Test
    void return_error_when_pattern_not_found_for_versions() throws Exception {
        when(patternStore.getPatternVersions(any())).thenThrow(new PatternNotFoundException());

        ToolResponse result = patternTools.listPatternVersions("workshop", 99);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    @Test
    void return_error_when_namespace_not_found_for_versions() throws Exception {
        when(patternStore.getPatternVersions(any())).thenThrow(new NamespaceNotFoundException());

        ToolResponse result = patternTools.listPatternVersions("missing", 1);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Namespace"));
    }

    @Test
    void reject_invalid_namespace_for_list_pattern_versions() {
        ToolResponse result = patternTools.listPatternVersions("bad ns", 1);

        assertThat(result.isError(), is(true));
        verifyNoInteractions(patternStore);
    }

    @Test
    void reject_non_positive_pattern_id_for_list_versions() {
        ToolResponse result = patternTools.listPatternVersions("workshop", 0);

        assertThat(result.isError(), is(true));
        verifyNoInteractions(patternStore);
    }

    // --- getPattern ---

    @Test
    void return_pattern_json_for_valid_version() throws Exception {
        when(patternStore.getPatternForVersion(any())).thenReturn("{\"nodes\":[],\"relationships\":[]}");

        ToolResponse result = patternTools.getPattern("workshop", 1, "1.0.0");

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("nodes"));
    }

    @Test
    void return_error_when_pattern_version_not_found() throws Exception {
        when(patternStore.getPatternForVersion(any())).thenThrow(new PatternVersionNotFoundException());

        ToolResponse result = patternTools.getPattern("workshop", 1, "9.9.9");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Version"));
    }

    @Test
    void return_error_when_namespace_not_found_for_get_pattern() throws Exception {
        when(patternStore.getPatternForVersion(any())).thenThrow(new NamespaceNotFoundException());

        ToolResponse result = patternTools.getPattern("missing", 1, "1.0.0");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Namespace"));
    }

    @Test
    void return_error_when_pattern_not_found_for_get() throws Exception {
        when(patternStore.getPatternForVersion(any())).thenThrow(new PatternNotFoundException());

        ToolResponse result = patternTools.getPattern("workshop", 99, "1.0.0");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Pattern"));
    }

    @Test
    void reject_invalid_namespace_for_get_pattern() {
        ToolResponse result = patternTools.getPattern("bad ns", 1, "1.0.0");

        assertThat(result.isError(), is(true));
        verifyNoInteractions(patternStore);
    }

    @Test
    void reject_invalid_version_for_get_pattern() {
        ToolResponse result = patternTools.getPattern("workshop", 1, "not-a-version");

        assertThat(result.isError(), is(true));
        verifyNoInteractions(patternStore);
    }

    @Test
    void reject_non_positive_pattern_id_for_get_pattern() {
        ToolResponse result = patternTools.getPattern("workshop", -1, "1.0.0");

        assertThat(result.isError(), is(true));
        verifyNoInteractions(patternStore);
    }

    // --- createPattern ---

    @Test
    void create_pattern_successfully() throws NamespaceNotFoundException {
        Pattern returnedPattern = new Pattern.PatternBuilder()
                .setNamespace("workshop")
                .setId(42)
                .setVersion("1.0.0")
                .build();
        when(patternStore.createPatternForNamespace(any(), anyString())).thenReturn(returnedPattern);

        ToolResponse result = patternTools.createPattern("workshop", "My Pattern", "A description", "{\"nodes\":[]}");

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("ID: 42"));
        assertThat(text(result), containsString("version 1.0.0"));
        assertThat(text(result), containsString("workshop"));
    }

    @Test
    void return_error_when_creating_pattern_in_missing_namespace() throws NamespaceNotFoundException {
        when(patternStore.createPatternForNamespace(any(), anyString())).thenThrow(new NamespaceNotFoundException());

        ToolResponse result = patternTools.createPattern("missing", "My Pattern", "desc", "{}");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    @Test
    void return_error_for_invalid_pattern_json_on_create() {
        ToolResponse result = patternTools.createPattern("workshop", "My Pattern", "desc", "not-json");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Invalid"));
        verifyNoInteractions(patternStore);
    }

    @Test
    void reject_invalid_namespace_for_create_pattern() {
        ToolResponse result = patternTools.createPattern("bad ns", "name", "desc", "{}");

        assertThat(result.isError(), is(true));
        verifyNoInteractions(patternStore);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   "})
    void reject_blank_json_for_create_pattern(String json) {
        ToolResponse result = patternTools.createPattern("workshop", "name", "desc", json);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Pattern JSON"));
        verifyNoInteractions(patternStore);
    }

    @Test
    void reject_pattern_name_exceeding_max_length() {
        String longName = "n".repeat(201);
        ToolResponse result = patternTools.createPattern("workshop", longName, "desc", "{}");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Pattern name"));
        verifyNoInteractions(patternStore);
    }

    @Test
    void reject_pattern_description_exceeding_max_length() {
        String longDesc = "d".repeat(1025);
        ToolResponse result = patternTools.createPattern("workshop", "name", longDesc, "{}");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Pattern description"));
        verifyNoInteractions(patternStore);
    }

    // --- createPatternVersion ---

    @Test
    void create_pattern_version_successfully() throws Exception {
        Pattern returnedPattern = new Pattern.PatternBuilder()
                .setNamespace("workshop")
                .setId(1)
                .setVersion("1.1.0")
                .build();
        when(patternStore.createPatternForVersion(any())).thenReturn(returnedPattern);

        ToolResponse result = patternTools.createPatternVersion("workshop", 1, "1.1.0", "{\"nodes\":[]}");

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("1.1.0"));
        assertThat(text(result), containsString("workshop"));
    }

    @Test
    void return_error_when_namespace_not_found_for_create_pattern_version() throws Exception {
        when(patternStore.createPatternForVersion(any())).thenThrow(new NamespaceNotFoundException());

        ToolResponse result = patternTools.createPatternVersion("missing", 1, "1.1.0", "{}");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Namespace"));
    }

    @Test
    void return_error_when_pattern_not_found_for_create_version() throws Exception {
        when(patternStore.createPatternForVersion(any())).thenThrow(new PatternNotFoundException());

        ToolResponse result = patternTools.createPatternVersion("workshop", 99, "1.1.0", "{}");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Pattern"));
        assertThat(text(result), containsString("not found"));
    }

    @Test
    void return_error_when_pattern_version_already_exists() throws Exception {
        when(patternStore.createPatternForVersion(any())).thenThrow(new PatternVersionExistsException());

        ToolResponse result = patternTools.createPatternVersion("workshop", 1, "1.0.0", "{}");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("already exists"));
    }

    @Test
    void reject_invalid_namespace_for_create_pattern_version() {
        ToolResponse result = patternTools.createPatternVersion("bad ns", 1, "1.1.0", "{}");

        assertThat(result.isError(), is(true));
        verifyNoInteractions(patternStore);
    }

    @Test
    void reject_non_positive_id_for_create_pattern_version() {
        ToolResponse result = patternTools.createPatternVersion("workshop", 0, "1.1.0", "{}");

        assertThat(result.isError(), is(true));
        verifyNoInteractions(patternStore);
    }

    @Test
    void reject_invalid_version_for_create_pattern_version() {
        ToolResponse result = patternTools.createPatternVersion("workshop", 1, "not-a-version", "{}");

        assertThat(result.isError(), is(true));
        verifyNoInteractions(patternStore);
    }

    @Test
    void return_error_for_invalid_json_on_create_pattern_version() {
        ToolResponse result = patternTools.createPatternVersion("workshop", 1, "1.1.0", "not-json");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Invalid"));
        verifyNoInteractions(patternStore);
    }

    // --- updatePattern ---

    @Test
    void update_pattern_version_successfully() throws Exception {
        Pattern returnedPattern = new Pattern.PatternBuilder()
                .setNamespace("workshop")
                .setId(1)
                .setVersion("1.0.0")
                .build();
        when(patternStore.updatePatternForVersion(any())).thenReturn(returnedPattern);

        ToolResponse result = patternTools.updatePattern("workshop", 1, "1.0.0", "{\"nodes\":[]}");

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("updated successfully"));
        assertThat(text(result), containsString("1.0.0"));
        assertThat(text(result), containsString("workshop"));
    }

    @Test
    void return_error_when_namespace_not_found_for_update_pattern() throws Exception {
        when(patternStore.updatePatternForVersion(any())).thenThrow(new NamespaceNotFoundException());

        ToolResponse result = patternTools.updatePattern("missing", 1, "1.0.0", "{}");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Namespace"));
        assertThat(text(result), containsString("not found"));
    }

    @Test
    void return_error_when_pattern_not_found_for_update() throws Exception {
        when(patternStore.updatePatternForVersion(any())).thenThrow(new PatternNotFoundException());

        ToolResponse result = patternTools.updatePattern("workshop", 99, "1.0.0", "{}");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Pattern"));
        assertThat(text(result), containsString("not found"));
    }

    @Test
    void reject_invalid_namespace_for_update_pattern() {
        ToolResponse result = patternTools.updatePattern("bad ns", 1, "1.0.0", "{}");

        assertThat(result.isError(), is(true));
        verifyNoInteractions(patternStore);
    }

    @Test
    void reject_non_positive_id_for_update_pattern() {
        ToolResponse result = patternTools.updatePattern("workshop", 0, "1.0.0", "{}");

        assertThat(result.isError(), is(true));
        verifyNoInteractions(patternStore);
    }

    @Test
    void reject_invalid_version_for_update_pattern() {
        ToolResponse result = patternTools.updatePattern("workshop", 1, "not-a-version", "{}");

        assertThat(result.isError(), is(true));
        verifyNoInteractions(patternStore);
    }

    @Test
    void return_error_for_invalid_json_on_update_pattern() {
        ToolResponse result = patternTools.updatePattern("workshop", 1, "1.0.0", "not-json");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Invalid"));
        verifyNoInteractions(patternStore);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   "})
    void reject_blank_json_for_update_pattern(String json) {
        ToolResponse result = patternTools.updatePattern("workshop", 1, "1.0.0", json);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Pattern JSON"));
        verifyNoInteractions(patternStore);
    }

    // --- MCP disabled ---

    @Test
    void return_disabled_message_when_mcp_is_disabled() {
        patternTools.mcpEnabled = false;

        assertThat(text(patternTools.listPatterns("workshop")), containsString("disabled"));
        assertThat(text(patternTools.listPatternVersions("workshop", 1)), containsString("disabled"));
        assertThat(text(patternTools.getPattern("workshop", 1, "1.0.0")), containsString("disabled"));
        assertThat(text(patternTools.createPattern("workshop", "n", "d", "{}")), containsString("disabled"));
        assertThat(text(patternTools.createPatternVersion("workshop", 1, "1.1.0", "{}")), containsString("disabled"));
        assertThat(text(patternTools.updatePattern("workshop", 1, "1.0.0", "{}")), containsString("disabled"));
        verifyNoInteractions(patternStore);
    }
}
