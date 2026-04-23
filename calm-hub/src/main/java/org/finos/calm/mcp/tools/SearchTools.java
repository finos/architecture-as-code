package org.finos.calm.mcp.tools;

import io.quarkiverse.mcp.server.Tool;
import io.quarkiverse.mcp.server.ToolArg;
import io.quarkiverse.mcp.server.ToolResponse;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.domain.search.GroupedSearchResults;
import org.finos.calm.domain.search.SearchResult;
import org.finos.calm.store.SearchStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * MCP tool provider for global search across CalmHub. Searches all resource
 * types (architectures, patterns, flows, standards, interfaces, controls, ADRs)
 * and returns grouped results via the Quarkiverse MCP server.
 */
@ApplicationScoped
public class SearchTools {

    private static final Logger logger = LoggerFactory.getLogger(SearchTools.class);
    private static final int MAX_QUERY_LENGTH = 200;
    private static final int MAX_RESULTS_PER_GROUP = 25;

    @Inject
    @ConfigProperty(name = "calm.mcp.enabled", defaultValue = "true")
    boolean mcpEnabled;

    @Inject
    SearchStore searchStore;

    @Tool(description = "Search across all resource types in CalmHub. Performs a global search across architectures, patterns, flows, standards, interfaces, controls, and ADRs. Results are grouped by type.")
    public ToolResponse searchHub(
            @ToolArg(description = "The search query string (1-200 characters)") String query) {
        String error = McpValidationHelper.checkEnabled(mcpEnabled);
        if (error != null) return ToolResponse.error(error);

        if (query == null || query.isBlank()) {
            return ToolResponse.error("Error: Search query must not be blank.");
        }

        if (query.length() > MAX_QUERY_LENGTH) {
            return ToolResponse.error("Error: Search query must not exceed " + MAX_QUERY_LENGTH + " characters.");
        }

        GroupedSearchResults groupedResults = searchStore.search(query);
        Map<String, List<SearchResult>> groups = toGroupMap(groupedResults);

        if (groups.values().stream().allMatch(List::isEmpty)) {
            return ToolResponse.success("No results found for '" + query + "'.");
        }

        StringBuilder sb = new StringBuilder("Search results for '" + query + "':\n");
        for (Map.Entry<String, List<SearchResult>> entry : groups.entrySet()) {
            List<SearchResult> items = entry.getValue();
            if (items.isEmpty()) {
                continue;
            }
            int total = items.size();
            int shown = Math.min(total, MAX_RESULTS_PER_GROUP);
            sb.append("\n").append(entry.getKey()).append(":\n");
            for (int i = 0; i < shown; i++) {
                SearchResult item = items.get(i);
                sb.append("- ID: ").append(item.getId());
                if (item.getName() != null) {
                    sb.append(", Name: ").append(item.getName());
                }
                if (item.getNamespace() != null) {
                    sb.append(", Namespace: ").append(item.getNamespace());
                }
                if (item.getDescription() != null) {
                    sb.append(", Description: ").append(item.getDescription());
                }
                sb.append("\n");
            }
            if (total > MAX_RESULTS_PER_GROUP) {
                sb.append("  (showing ").append(shown).append(" of ").append(total).append(")\n");
            }
        }
        return ToolResponse.success(sb.toString());
    }

    private static Map<String, List<SearchResult>> toGroupMap(GroupedSearchResults results) {
        Map<String, List<SearchResult>> map = new LinkedHashMap<>();
        map.put("architectures", results.getArchitectures());
        map.put("patterns", results.getPatterns());
        map.put("flows", results.getFlows());
        map.put("standards", results.getStandards());
        map.put("interfaces", results.getInterfaces());
        map.put("controls", results.getControls());
        map.put("adrs", results.getAdrs());
        return map;
    }
}
