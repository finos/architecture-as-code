package org.finos.calm.mcp.tools;

import io.quarkiverse.mcp.server.ToolResponse;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.enterprise.inject.Instance;
import org.finos.calm.domain.search.GroupedSearchResults;
import org.finos.calm.domain.search.SearchResult;
import org.finos.calm.security.UserAccessValidator;
import org.finos.calm.store.SearchStore;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.security.Principal;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestSearchToolsShould {

    @Mock
    SearchStore searchStore;

    @Mock
    Instance<UserAccessValidator> userAccessValidatorInstance;

    @Mock
    SecurityIdentity identity;

    @Mock
    Principal mockPrincipal;

    @InjectMocks
    SearchTools searchTools;

    @BeforeEach
    void setup() {
        searchTools.mcpEnabled = true;
        searchTools.authEnabled = false;
        lenient().when(userAccessValidatorInstance.isResolvable()).thenReturn(false);
    }

    private static final List<SearchResult> EMPTY = List.of();

    /** Extract the text payload from a ToolResponse for assertion purposes. */
    private static String text(ToolResponse r) {
        return r.firstContent().asText().text();
    }

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

        when(searchStore.search(eq("trade"), any())).thenReturn(grouped);

        String result = text(searchTools.searchHub("trade"));

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

        when(searchStore.search(eq("nonexistent"), any())).thenReturn(grouped);

        String result = text(searchTools.searchHub("nonexistent"));

        assertThat(result, containsString("No results found"));
    }

    @Test
    void return_error_for_null_query() {
        ToolResponse response = searchTools.searchHub(null);

        assertThat(response.isError(), org.hamcrest.Matchers.is(true));
        assertThat(text(response), containsString("blank"));
        verifyNoInteractions(searchStore);
    }

    @Test
    void return_error_for_blank_query() {
        ToolResponse response = searchTools.searchHub("   ");

        assertThat(response.isError(), org.hamcrest.Matchers.is(true));
        assertThat(text(response), containsString("blank"));
        verifyNoInteractions(searchStore);
    }

    @Test
    void return_error_for_query_exceeding_max_length() {
        String longQuery = "a".repeat(201);

        ToolResponse response = searchTools.searchHub(longQuery);

        assertThat(response.isError(), org.hamcrest.Matchers.is(true));
        assertThat(text(response), containsString("200"));
        verifyNoInteractions(searchStore);
    }

    @Test
    void accept_query_at_max_length_boundary() {
        String maxQuery = "a".repeat(200);

        GroupedSearchResults grouped = new GroupedSearchResults(
                EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY);
        when(searchStore.search(eq(maxQuery), any())).thenReturn(grouped);

        String result = text(searchTools.searchHub(maxQuery));

        assertThat(result, containsString("No results found"));
    }

    @Test
    void skip_empty_groups_in_results() {
        List<SearchResult> archResults = List.of(
                new SearchResult("workshop", 1, "My Arch", "desc")
        );

        GroupedSearchResults grouped = new GroupedSearchResults(
                archResults, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY);

        when(searchStore.search(eq("arch"), any())).thenReturn(grouped);

        String result = text(searchTools.searchHub("arch"));

        assertThat(result, containsString("architectures:"));
        assertThat(result, not(containsString("controls:")));
        assertThat(result, not(containsString("patterns:")));
    }

    // --- namespace filtering ---

    @Test
    void pass_empty_optional_to_store_when_auth_disabled() {
        GroupedSearchResults grouped = new GroupedSearchResults(EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY);
        when(searchStore.search(eq("trade"), any())).thenReturn(grouped);

        searchTools.searchHub("trade");

        verify(searchStore).search(eq("trade"), eq(Optional.empty()));
    }

    @Test
    void pass_readable_namespaces_to_store_when_auth_enabled() {
        UserAccessValidator mockValidator = org.mockito.Mockito.mock(UserAccessValidator.class);
        searchTools.authEnabled = true;
        when(userAccessValidatorInstance.isResolvable()).thenReturn(true);
        when(identity.getPrincipal()).thenReturn(mockPrincipal);
        when(mockPrincipal.getName()).thenReturn("alice");
        when(userAccessValidatorInstance.get()).thenReturn(mockValidator);
        when(mockValidator.getReadableNamespaces("alice")).thenReturn(Set.of("finos"));

        GroupedSearchResults grouped = new GroupedSearchResults(EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY);
        when(searchStore.search(eq("trade"), any())).thenReturn(grouped);

        searchTools.searchHub("trade");

        verify(searchStore).search(eq("trade"), eq(Optional.of(Set.of("finos"))));
    }

    // --- MCP disabled ---

    @Test
    void return_disabled_message_when_mcp_is_disabled() {
        searchTools.mcpEnabled = false;

        ToolResponse response = searchTools.searchHub("trade");
        assertThat(response.isError(), org.hamcrest.Matchers.is(true));
        assertThat(text(response), containsString("disabled"));
        verifyNoInteractions(searchStore);
    }
}
