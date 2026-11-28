package org.finos.calm.mcp.tools;

import io.quarkiverse.mcp.server.TextContent;
import io.quarkiverse.mcp.server.ToolResponse;
import org.finos.calm.domain.Tags;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;

class TestMcpResponseFormatterShould {

    @Test
    void show_the_path_and_variant_from_a_listing_entry_when_present() {
        ToolResponse response = McpResponseFormatter.formatResourceList("pattern", "namespace", "finos",
                List.of(new McpResponseFormatter.ResourceSummary("foo.dev", "Foo", "desc",
                        new Tags("team", "dev"))));

        String text = ((TextContent) response.firstContent()).text();
        assertThat(text, containsString("ID: foo.dev"));
        assertThat(text, containsString("Path: team"));
        assertThat(text, containsString("Variant: dev"));
    }

    @Test
    void omit_tags_that_a_listing_entry_does_not_have() {
        ToolResponse response = McpResponseFormatter.formatResourceList("pattern", "namespace", "finos",
                List.of(new McpResponseFormatter.ResourceSummary("foo", "Foo", "desc")));

        String text = ((TextContent) response.firstContent()).text();
        assertThat(text, not(containsString("Path:")));
        assertThat(text, not(containsString("Variant:")));
    }
}
