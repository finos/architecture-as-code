package org.finos.calm.mcp.tools;

import io.quarkiverse.mcp.server.FilterContext;
import io.quarkiverse.mcp.server.McpMethod;
import io.quarkiverse.mcp.server.ToolManager.ToolInfo;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.Optional;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TestReadOnlyHubToolFilterShould {

    @ParameterizedTest
    @ValueSource(strings = {"read", "domainRead", "search"})
    void list_a_read_tool_on_a_read_only_hub(String name) throws Exception {
        assertThat(ReadOnlyHubToolFilter.visible(tool(name), McpMethod.TOOLS_LIST, true), is(true));
    }

    @ParameterizedTest
    @ValueSource(strings = {"write", "readOrWrite", "admin", "unannotated"})
    void hide_a_tool_that_changes_data_on_a_read_only_hub(String name) throws Exception {
        assertThat(ReadOnlyHubToolFilter.visible(tool(name), McpMethod.TOOLS_LIST, true), is(false));
    }

    @ParameterizedTest
    @ValueSource(strings = {"read", "domainRead", "search", "write", "readOrWrite", "admin", "unannotated"})
    void list_every_tool_on_a_hub_that_is_not_read_only(String name) throws Exception {
        assertThat(ReadOnlyHubToolFilter.visible(tool(name), McpMethod.TOOLS_LIST, false), is(true));
    }

    // The guard must answer a call to a hidden tool, so the filter must not turn it into "tool not found".
    @Test
    void keep_a_tool_that_changes_data_callable_on_a_read_only_hub() throws Exception {
        assertThat(ReadOnlyHubToolFilter.visible(tool("write"), McpMethod.TOOLS_CALL, true), is(true));
    }

    // A tool registered through ToolManager has no method for the guard to classify.
    @Test
    void list_a_programmatically_registered_tool_on_a_read_only_hub() {
        ToolInfo tool = mock(ToolInfo.class);
        when(tool.method()).thenReturn(Optional.empty());

        assertThat(ReadOnlyHubToolFilter.visible(tool, McpMethod.TOOLS_LIST, true), is(true));
    }

    @Test
    void list_a_read_tool_whatever_the_configured_setting() throws Exception {
        FilterContext context = mock(FilterContext.class);
        when(context.method()).thenReturn(McpMethod.TOOLS_LIST);

        assertThat(new ReadOnlyHubToolFilter().test(tool("read"), context), is(true));
    }

    private static ToolInfo tool(String name) throws NoSuchMethodException {
        ToolInfo tool = mock(ToolInfo.class);
        when(tool.method()).thenReturn(Optional.of(TestReadOnlyHubGuardInterceptorShould.method(name)));
        return tool;
    }
}
