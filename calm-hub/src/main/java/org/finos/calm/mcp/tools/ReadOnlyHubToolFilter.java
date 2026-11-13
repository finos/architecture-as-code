package org.finos.calm.mcp.tools;

import io.quarkiverse.mcp.server.FilterContext;
import io.quarkiverse.mcp.server.McpMethod;
import io.quarkiverse.mcp.server.ToolFilter;
import io.quarkiverse.mcp.server.ToolManager.ToolInfo;
import jakarta.enterprise.context.ApplicationScoped;

/**
 * On a read-only Hub, hides from {@code tools/list} each tool that {@link ReadOnlyHubGuardInterceptor} refuses.
 * This is Hub-wide, not per user. Only {@code tools/list} is filtered: the filter also runs on {@code tools/call},
 * and there a hidden tool must still get the guard's read-only error, not "tool not found".
 * A tool registered through {@code ToolManager} has no method, so it stays listed and must refuse writes itself.
 */
@ApplicationScoped
public class ReadOnlyHubToolFilter implements ToolFilter {

    @Override
    public boolean test(ToolInfo tool, FilterContext context) {
        return visible(tool, context.method(), ReadOnlyHubGuardInterceptor.readOnlyHub());
    }

    static boolean visible(ToolInfo tool, McpMethod method, boolean readOnly) {
        if (!readOnly || method != McpMethod.TOOLS_LIST) {
            return true;
        }
        return tool.method().map(m -> !ReadOnlyHubGuardInterceptor.changesData(m)).orElse(true);
    }
}
