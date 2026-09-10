package org.finos.calm.store.github.registry;

import org.junit.jupiter.api.Test;

import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;

class TestRegistrySnapshotShould {

    private static final RegistryEntry FINOS_PATTERN = new RegistryEntry("finos-pattern",
            Path.of("patterns/finos-pattern.json"), RegistryResourceType.PATTERN, "FINOS Pattern", Instant.now());
    private static final RegistryEntry FINOS_FLOW = new RegistryEntry("finos-flow",
            Path.of("flows/finos-flow.json"), RegistryResourceType.FLOW, "FINOS Flow", Instant.now());
    private static final RegistryEntry OTHER_PATTERN = new RegistryEntry("other-pattern",
            Path.of("patterns/other-pattern.json"), RegistryResourceType.PATTERN, "Other Pattern", Instant.now());

    private static RegistrySnapshot buildSnapshot() {
        return new RegistrySnapshot(
                Map.of(
                        "finos", List.of(FINOS_PATTERN, FINOS_FLOW),
                        "other", List.of(OTHER_PATTERN)
                ),
                Map.of(
                        "finos:finos-pattern", FINOS_PATTERN,
                        "finos:finos-flow", FINOS_FLOW,
                        "other:other-pattern", OTHER_PATTERN
                ));
    }

    @Test
    void find_an_entry_by_its_qualified_id() {
        Optional<RegistryEntry> found = buildSnapshot().findByUniqueId("finos", "finos-pattern");

        assertThat(found.isPresent(), is(true));
        assertThat(found.get(), equalTo(FINOS_PATTERN));
    }

    @Test
    void not_find_an_entry_that_exists_only_under_a_different_namespace() {
        Optional<RegistryEntry> found = buildSnapshot().findByUniqueId("other", "finos-pattern");

        assertThat(found.isPresent(), is(false));
    }

    @Test
    void not_find_an_unknown_unique_id() {
        Optional<RegistryEntry> found = buildSnapshot().findByUniqueId("finos", "does-not-exist");

        assertThat(found.isPresent(), is(false));
    }

    @Test
    void list_entries_by_type_scoped_to_one_namespace() {
        List<RegistryEntry> patterns = buildSnapshot().listByType("finos", RegistryResourceType.PATTERN);

        assertThat(patterns, contains(FINOS_PATTERN));
    }

    @Test
    void return_empty_list_by_type_for_a_namespace_with_no_matching_entries() {
        List<RegistryEntry> flows = buildSnapshot().listByType("other", RegistryResourceType.FLOW);

        assertThat(flows, is(empty()));
    }

    @Test
    void return_empty_list_by_type_for_an_unknown_namespace() {
        List<RegistryEntry> patterns = buildSnapshot().listByType("nonexistent", RegistryResourceType.PATTERN);

        assertThat(patterns, is(empty()));
    }

    @Test
    void list_all_entries_for_a_namespace_regardless_of_type() {
        List<RegistryEntry> all = buildSnapshot().listAll("finos");

        assertThat(all, containsInAnyOrder(FINOS_PATTERN, FINOS_FLOW));
    }

    @Test
    void return_empty_list_all_for_an_unknown_namespace() {
        assertThat(buildSnapshot().listAll("nonexistent"), is(empty()));
    }

    @Test
    void list_every_known_namespace() {
        assertThat(buildSnapshot().getNamespaces(), containsInAnyOrder("finos", "other"));
    }

    @Test
    void the_empty_constant_has_no_namespaces_entries_or_types() {
        assertThat(RegistrySnapshot.EMPTY.getNamespaces(), is(empty()));
        assertThat(RegistrySnapshot.EMPTY.listAll("finos"), is(empty()));
        assertThat(RegistrySnapshot.EMPTY.listByType("finos", RegistryResourceType.PATTERN), is(empty()));
        assertThat(RegistrySnapshot.EMPTY.findByUniqueId("finos", "anything").isPresent(), is(false));
    }
}
