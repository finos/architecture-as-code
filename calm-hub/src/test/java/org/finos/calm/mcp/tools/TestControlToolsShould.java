package org.finos.calm.mcp.tools;

import io.quarkiverse.mcp.server.TextContent;
import io.quarkiverse.mcp.server.ToolResponse;
import org.finos.calm.domain.controls.ControlDetail;
import org.finos.calm.domain.exception.ControlNotFoundException;
import org.finos.calm.domain.exception.ControlRequirementVersionNotFoundException;
import org.finos.calm.domain.exception.DomainNotFoundException;
import org.finos.calm.store.ControlStore;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
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
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestControlToolsShould {

    @Mock
    ControlStore controlStore;

    @InjectMocks
    ControlTools controlTools;

    @BeforeEach
    void setup() {
        controlTools.mcpEnabled = true;
    }

    private static String text(ToolResponse r) {
        return ((TextContent) r.firstContent()).text();
    }

    // --- listControls ---

    @Test
    void return_controls_for_domain() throws DomainNotFoundException {
        when(controlStore.getControlsForDomain("security"))
                .thenReturn(List.of(
                        new ControlDetail(1, "BOLA", "Broken Object Level Authorization"),
                        new ControlDetail(2, "Broken Auth", "Broken Authentication")
                ));

        ToolResponse result = controlTools.listControls("security");

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("BOLA"));
        assertThat(text(result), containsString("Broken Auth"));
        assertThat(text(result), containsString("security"));
    }

    @Test
    void return_empty_message_when_no_controls() throws DomainNotFoundException {
        when(controlStore.getControlsForDomain("empty-domain"))
                .thenReturn(List.of());

        ToolResponse result = controlTools.listControls("empty-domain");

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("No controls found"));
    }

    @Test
    void return_error_for_missing_domain() throws DomainNotFoundException {
        when(controlStore.getControlsForDomain("missing"))
                .thenThrow(new DomainNotFoundException("missing"));

        ToolResponse result = controlTools.listControls("missing");

        assertThat(result.isError(), is(true));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   ", "bad domain", "bad.domain"})
    void reject_invalid_domain_for_list_controls(String domain) {
        ToolResponse result = controlTools.listControls(domain);

        assertThat(result.isError(), is(true));
        verifyNoInteractions(controlStore);
    }

    // --- getControl ---

    @Test
    void return_control_json() throws Exception {
        when(controlStore.getRequirementForVersion("security", 1, "1.0.0"))
                .thenReturn("{\"name\":\"BOLA\",\"description\":\"...\"}");

        ToolResponse result = controlTools.getControl("security", 1, "1.0.0");

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("BOLA"));
    }

    @Test
    void return_error_for_missing_control_version() throws Exception {
        when(controlStore.getRequirementForVersion("security", 1, "9.9.9"))
                .thenThrow(new ControlRequirementVersionNotFoundException());

        ToolResponse result = controlTools.getControl("security", 1, "9.9.9");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Version"));
    }

    @Test
    void return_error_for_missing_domain_on_get() throws Exception {
        when(controlStore.getRequirementForVersion("missing", 1, "1.0.0"))
                .thenThrow(new DomainNotFoundException("missing"));

        ToolResponse result = controlTools.getControl("missing", 1, "1.0.0");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Domain"));
    }

    @Test
    void return_error_for_missing_control_on_get() throws Exception {
        when(controlStore.getRequirementForVersion("security", 99, "1.0.0"))
                .thenThrow(new ControlNotFoundException());

        ToolResponse result = controlTools.getControl("security", 99, "1.0.0");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Control"));
    }

    @Test
    void reject_invalid_domain_for_get_control() {
        ToolResponse result = controlTools.getControl("bad domain", 1, "1.0.0");

        assertThat(result.isError(), is(true));
        verifyNoInteractions(controlStore);
    }

    @Test
    void reject_invalid_version_for_get_control() {
        ToolResponse result = controlTools.getControl("security", 1, "not-a-version");

        assertThat(result.isError(), is(true));
        verifyNoInteractions(controlStore);
    }

    @Test
    void reject_non_positive_control_id_for_get_control() {
        ToolResponse result = controlTools.getControl("security", 0, "1.0.0");

        assertThat(result.isError(), is(true));
        verifyNoInteractions(controlStore);
    }

    // --- listControlVersions ---

    @Test
    void return_control_versions() throws Exception {
        when(controlStore.getRequirementVersions("security", 1))
                .thenReturn(List.of("1.0.0", "2.0.0"));

        ToolResponse result = controlTools.listControlVersions("security", 1);

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("1.0.0"));
        assertThat(text(result), containsString("2.0.0"));
    }

    @Test
    void return_empty_versions_message() throws Exception {
        when(controlStore.getRequirementVersions("security", 1))
                .thenReturn(List.of());

        ToolResponse result = controlTools.listControlVersions("security", 1);

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("No versions found"));
    }

    @Test
    void return_error_when_control_not_found_for_versions() throws Exception {
        when(controlStore.getRequirementVersions("security", 99))
                .thenThrow(new ControlNotFoundException());

        ToolResponse result = controlTools.listControlVersions("security", 99);

        assertThat(result.isError(), is(true));
    }

    @Test
    void return_error_when_domain_not_found_for_versions() throws Exception {
        when(controlStore.getRequirementVersions("missing", 1))
                .thenThrow(new DomainNotFoundException("missing"));

        ToolResponse result = controlTools.listControlVersions("missing", 1);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Domain"));
    }

    @Test
    void reject_invalid_domain_for_list_versions() {
        ToolResponse result = controlTools.listControlVersions("bad domain", 1);

        assertThat(result.isError(), is(true));
        verifyNoInteractions(controlStore);
    }

    @Test
    void reject_non_positive_control_id_for_list_versions() {
        ToolResponse result = controlTools.listControlVersions("security", -1);

        assertThat(result.isError(), is(true));
        verifyNoInteractions(controlStore);
    }

    // --- MCP disabled ---

    @Test
    void return_disabled_message_when_mcp_is_disabled() {
        controlTools.mcpEnabled = false;

        assertThat(text(controlTools.listControls("security")), containsString("disabled"));
        assertThat(text(controlTools.getControl("security", 1, "1.0.0")), containsString("disabled"));
        assertThat(text(controlTools.listControlVersions("security", 1)), containsString("disabled"));
        verifyNoInteractions(controlStore);
    }
}
