package org.finos.calm.mcp.tools;

import org.finos.calm.domain.exception.FlowNotFoundException;
import org.finos.calm.domain.exception.FlowVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.flow.NamespaceFlowSummary;
import org.finos.calm.store.FlowStore;
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
import static org.hamcrest.Matchers.startsWith;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestFlowToolsShould {

    @Mock
    FlowStore flowStore;

    @InjectMocks
    FlowTools flowTools;

    @BeforeEach
    void setup() {
        flowTools.mcpEnabled = true;
    }

    // --- listFlows ---

    @Test
    void return_flows_for_namespace() throws NamespaceNotFoundException {
        when(flowStore.getFlowsForNamespace("workshop"))
                .thenReturn(List.of(
                        new NamespaceFlowSummary("Signup Flow", "User registration flow", 1)
                ));

        String result = flowTools.listFlows("workshop");

        assertThat(result, containsString("Signup Flow"));
        assertThat(result, containsString("ID: 1"));
    }

    @Test
    void return_empty_message_when_no_flows() throws NamespaceNotFoundException {
        when(flowStore.getFlowsForNamespace("empty"))
                .thenReturn(List.of());

        String result = flowTools.listFlows("empty");

        assertThat(result, containsString("No flows found"));
    }

    @Test
    void return_error_for_nonexistent_namespace() throws NamespaceNotFoundException {
        when(flowStore.getFlowsForNamespace("missing"))
                .thenThrow(new NamespaceNotFoundException());

        String result = flowTools.listFlows("missing");

        assertThat(result, startsWith("Error:"));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   ", "bad namespace"})
    void reject_invalid_namespace_for_list_flows(String namespace) {
        String result = flowTools.listFlows(namespace);

        assertThat(result, startsWith("Error:"));
        verifyNoInteractions(flowStore);
    }

    // --- getFlow ---

    @Test
    void return_flow_json_for_valid_version() throws Exception {
        when(flowStore.getFlowForVersion(any()))
                .thenReturn("{\"transitions\":[]}");

        String result = flowTools.getFlow("workshop", 1, "1.0.0");

        assertThat(result, containsString("transitions"));
    }

    @Test
    void return_error_when_flow_version_not_found() throws Exception {
        when(flowStore.getFlowForVersion(any()))
                .thenThrow(new FlowVersionNotFoundException());

        String result = flowTools.getFlow("workshop", 1, "9.9.9");

        assertThat(result, startsWith("Error:"));
        assertThat(result, containsString("Version"));
    }

    @Test
    void return_error_when_flow_not_found() throws Exception {
        when(flowStore.getFlowForVersion(any()))
                .thenThrow(new FlowNotFoundException());

        String result = flowTools.getFlow("workshop", 99, "1.0.0");

        assertThat(result, startsWith("Error:"));
        assertThat(result, containsString("not found"));
    }

    @Test
    void return_error_when_namespace_not_found_for_get_flow() throws Exception {
        when(flowStore.getFlowForVersion(any()))
                .thenThrow(new NamespaceNotFoundException());

        String result = flowTools.getFlow("missing", 1, "1.0.0");

        assertThat(result, startsWith("Error:"));
        assertThat(result, containsString("Namespace"));
    }

    @Test
    void reject_invalid_namespace_for_get_flow() {
        String result = flowTools.getFlow("bad ns", 1, "1.0.0");

        assertThat(result, startsWith("Error:"));
        verifyNoInteractions(flowStore);
    }

    @Test
    void reject_invalid_version_for_get_flow() {
        String result = flowTools.getFlow("workshop", 1, "not-a-version");

        assertThat(result, startsWith("Error:"));
        verifyNoInteractions(flowStore);
    }

    // --- MCP disabled ---

    @Test
    void return_disabled_message_when_mcp_is_disabled() {
        flowTools.mcpEnabled = false;

        assertThat(flowTools.listFlows("workshop"), containsString("disabled"));
        assertThat(flowTools.getFlow("workshop", 1, "1.0.0"), containsString("disabled"));
        verifyNoInteractions(flowStore);
    }
}
