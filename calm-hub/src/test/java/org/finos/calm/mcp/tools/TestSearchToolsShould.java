package org.finos.calm.mcp.tools;

import org.finos.calm.domain.search.GroupedSearchResults;
import org.finos.calm.domain.search.SearchResult;
import org.finos.calm.store.SearchStore;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.startsWith;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestSearchToolsShould {

    @Mock
    SearchStore searchStore;

    @InjectMocks
    SearchTools searchTools;

    @BeforeEach
    void setup() {
        searchTools.mcpEnabled = true;
    }

    private static final List<SearchResult> EMPTY = List.of();

    @Test
    void return_grouped_results_for_valid_query() {
        List<SearchResult> archResults = List.of(
                new SearchResult("workshop", 1, "Trade Platform", "Trading architecture")
        );
        List<SearchResult> controlResults = List.of(
                new SearchResult("api-threats", 2, "BOLA", "Broken Object Level Authorization")
        );

        GroupedSearchResults grouped = new GroupedSearchResults(
                archResults, EMPTY, EMPTY, EMPTY, EMPTY, controlResults, EMPTY);

        when(searchStore.search("trade")).thenReturn(grouped);

        String result = searchTools.searchHub("trade");

        assertThat(result, containsString("Search results for 'trade'"));
        assertThat(result, containsString("architectures:"));
        assertThat(result, containsString("Trade Platform"));
        assertThat(result, containsString("Namespace: workshop"));
        assertThat(result, containsString("controls:"));
        assertThat(result, containsString("BOLA"));
    }

    @Test
    void return_no_results_message_for_all_empty() {
        GroupedSearchResults grouped = new GroupedSearchResults(
                EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY);

        when(searchStore.search("nonexistent")).thenReturn(grouped);

        String result = searchTools.searchHub("nonexistent");

        assertThat(result, containsString("No results found"));
    }

    @Test
    void return_error_for_null_query() {
        String result = searchTools.searchHub(null);

        assertThat(result, startsWith("Error:"));
        assertThat(result, containsString("blank"));
        verifyNoInteractions(searchStore);
    }

    @Test
    void return_error_for_blank_query() {
        String result = searchTools.searchHub("   ");

        assertThat(result, startsWith("Error:"));
        assertThat(result, containsString("blank"));
        verifyNoInteractions(searchStore);
    }

    @Test
    void return_error_for_query_exceeding_max_length() {
        String longQuery = "a".repeat(201);

        String result = searchTools.searchHub(longQuery);

        assertThat(result, startsWith("Error:"));
        assertThat(result, containsString("200"));
        verifyNoInteractions(searchStore);
    }

    @Test
    void skip_empty_groups_in_results() {
        List<SearchResult> archResults = List.of(
                new SearchResult("workshop", 1, "My Arch", "desc")
        );

        GroupedSearchResults grouped = new GroupedSearchResults(
                archResults, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY);

        when(searchStore.search("arch")).thenReturn(grouped);

        String result = searchTools.searchHub("arch");

        assertThat(result, containsString("architectures:"));
        assertThat(result, not(containsString("controls:")));
        assertThat(result, not(containsString("patterns:")));
    }

    // --- MCP disabled ---

    @Test
    void return_disabled_message_when_mcp_is_disabled() {
        searchTools.mcpEnabled = false;

        assertThat(searchTools.searchHub("trade"), containsString("disabled"));
        verifyNoInteractions(searchStore);
    }
}
