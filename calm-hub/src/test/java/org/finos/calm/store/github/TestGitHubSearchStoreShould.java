package org.finos.calm.store.github;

import org.finos.calm.domain.search.GroupedSearchResults;
import org.finos.calm.store.SearchStore;
import org.finos.calm.store.github.registry.RegistryEntry;
import org.finos.calm.store.github.registry.RegistryResourceType;
import org.finos.calm.store.github.registry.ResourceRegistry;
import org.finos.calm.store.github.registry.RegistrySnapshot;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.mockito.Mockito.when;

@MockitoSettings(strictness = Strictness.LENIENT)
@ExtendWith(MockitoExtension.class)
class TestGitHubSearchStoreShould {

    @Mock
    private ResourceRegistry registryService;

    private GitHubSearchStore store;

    @BeforeEach
    void setup() {
        store = new GitHubSearchStore(registryService);
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);
    }

    @Test
    void return_empty_grouped_search_results() {
        GroupedSearchResults result = store.search("test query", Optional.empty());

        assertThat(result, is(notNullValue()));
        assertThat(result.getArchitectures(), is(empty()));
        assertThat(result.getPatterns(), is(empty()));
        assertThat(result.getFlows(), is(empty()));
        assertThat(result.getStandards(), is(empty()));
        assertThat(result.getInterfaces(), is(empty()));
        assertThat(result.getControls(), is(empty()));
        assertThat(result.getAdrs(), is(empty()));
    }

    @Test
    void return_empty_results_with_readable_namespaces() {
        GroupedSearchResults result = store.search("test", Optional.of(Set.of("finos")));

        assertThat(result, is(notNullValue()));
        assertThat(result.getArchitectures(), is(empty()));
    }

    @Test
    void return_empty_for_blank_query() {
        GroupedSearchResults result = store.search("", Optional.empty());
        assertThat(result.getArchitectures(), is(empty()));
    }

    @Test
    void return_empty_for_null_query() {
        GroupedSearchResults result = store.search(null, Optional.empty());
        assertThat(result.getArchitectures(), is(empty()));
    }

    @Test
    void find_entries_matching_query_by_name() {
        org.finos.calm.store.github.registry.RegistryEntry entry = new org.finos.calm.store.github.registry.RegistryEntry(
                "payment-svc", java.nio.file.Path.of("architectures/payment.json"),
                org.finos.calm.store.github.registry.RegistryResourceType.ARCHITECTURE, "Payment Service", java.time.Instant.now());
        org.finos.calm.store.github.registry.RegistrySnapshot snapshot = new org.finos.calm.store.github.registry.RegistrySnapshot(
                java.util.Map.of("finos", java.util.List.of(entry)),
                java.util.Map.of("finos:payment-svc", entry)
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);

        GroupedSearchResults result = store.search("payment", Optional.empty());

        assertThat(result.getArchitectures(), is(org.hamcrest.Matchers.not(empty())));
        assertThat(result.getArchitectures().get(0).getName(), is("Payment Service"));
    }

    @Test
    void not_let_one_types_matches_starve_another_types_matches() {
        // More architecture matches than the old combined cap (MAX_RESULTS_PER_TYPE * 7)
        // could ever let through, all sorting ahead of the one pattern match in the
        // merged, per-namespace-ordered stream. The pattern match must still come back.
        List<RegistryEntry> entries = new ArrayList<>();
        for (int i = 0; i < (SearchStore.MAX_RESULTS_PER_TYPE * 7) + 5; i++) {
            entries.add(new RegistryEntry("payment-arch-" + i, Path.of("architectures/payment-" + i + ".json"),
                    RegistryResourceType.ARCHITECTURE, "Payment Architecture " + i, Instant.now()));
        }
        entries.add(new RegistryEntry("payment-pattern", Path.of("patterns/payment.json"),
                RegistryResourceType.PATTERN, "Payment Pattern", Instant.now()));

        RegistrySnapshot snapshot = new RegistrySnapshot(Map.of("finos", entries), Map.of());
        when(registryService.getSnapshot()).thenReturn(snapshot);

        GroupedSearchResults result = store.search("payment", Optional.empty());

        assertThat(result.getArchitectures(), is(org.hamcrest.Matchers.not(empty())));
        assertThat(result.getPatterns(), is(org.hamcrest.Matchers.not(empty())));
        assertThat(result.getPatterns().get(0).getName(), is("Payment Pattern"));
    }
}
