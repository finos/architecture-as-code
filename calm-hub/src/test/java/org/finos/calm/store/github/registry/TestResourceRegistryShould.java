package org.finos.calm.store.github.registry;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;

class TestResourceRegistryShould {

    private ResourceRegistry registryService;

    @TempDir
    Path tempDir;

    @BeforeEach
    void setup() {
        registryService = new ResourceRegistry(new CalmContentDetector());
    }

    @Test
    void return_empty_snapshot_before_rebuild() {
        List<RegistryEntry> entries = registryService.listByType("finos", RegistryResourceType.ARCHITECTURE);
        assertThat(entries, is(empty()));
    }

    @Test
    void discover_architecture_from_json_with_nodes() throws IOException {
        Path archDir = tempDir.resolve("architectures");
        Files.createDirectories(archDir);
        Files.writeString(archDir.resolve("payment.json"),
                "{\"unique-id\": \"payment-platform\", \"name\": \"Payment Platform\", \"nodes\": [], \"relationships\": []}");

        registryService.rebuild(Map.of("finos", tempDir));

        List<RegistryEntry> entries = registryService.listByType("finos", RegistryResourceType.ARCHITECTURE);
        assertThat(entries, hasSize(1));
        assertThat(entries.get(0).uniqueId(), equalTo("payment-platform"));
        assertThat(entries.get(0).name(), equalTo("Payment Platform"));
    }

    @Test
    void discover_pattern_from_patterns_directory() throws IOException {
        Path patternDir = tempDir.resolve("patterns");
        Files.createDirectories(patternDir);
        Files.writeString(patternDir.resolve("event-driven.json"),
                "{\"unique-id\": \"event-driven\", \"name\": \"Event Driven\", \"nodes\": [{\"unique-id\": \"broker\"}]}");

        registryService.rebuild(Map.of("finos", tempDir));

        List<RegistryEntry> entries = registryService.listByType("finos", RegistryResourceType.PATTERN);
        assertThat(entries, hasSize(1));
        assertThat(entries.get(0).uniqueId(), equalTo("event-driven"));
    }

    @Test
    void derive_unique_id_from_filename_when_missing() throws IOException {
        Path archDir = tempDir.resolve("architectures");
        Files.createDirectories(archDir);
        Files.writeString(archDir.resolve("my-system.json"),
                "{\"name\": \"My System\", \"nodes\": []}");

        registryService.rebuild(Map.of("finos", tempDir));

        List<RegistryEntry> entries = registryService.listByType("finos", RegistryResourceType.ARCHITECTURE);
        assertThat(entries, hasSize(1));
        assertThat(entries.get(0).uniqueId(), equalTo("my-system"));
    }

    @Test
    void find_entry_by_unique_id() throws IOException {
        Path archDir = tempDir.resolve("architectures");
        Files.createDirectories(archDir);
        Files.writeString(archDir.resolve("payment.json"),
                "{\"unique-id\": \"payment-svc\", \"nodes\": []}");

        registryService.rebuild(Map.of("finos", tempDir));

        Optional<RegistryEntry> found = registryService.findByUniqueId("finos", "payment-svc");
        assertThat(found.isPresent(), is(true));
        assertThat(found.get().uniqueId(), equalTo("payment-svc"));
    }

    @Test
    void return_empty_for_unknown_unique_id() throws IOException {
        registryService.rebuild(Map.of("finos", tempDir));

        Optional<RegistryEntry> found = registryService.findByUniqueId("finos", "nonexistent");
        assertThat(found.isPresent(), is(false));
    }

    @Test
    void skip_hidden_directories() throws IOException {
        Path hiddenDir = tempDir.resolve(".git");
        Files.createDirectories(hiddenDir);
        Files.writeString(hiddenDir.resolve("config.json"), "{\"nodes\": []}");

        Path archDir = tempDir.resolve("architectures");
        Files.createDirectories(archDir);
        Files.writeString(archDir.resolve("real.json"), "{\"unique-id\": \"real\", \"nodes\": []}");

        registryService.rebuild(Map.of("finos", tempDir));

        List<RegistryEntry> entries = registryService.listByType("finos", RegistryResourceType.ARCHITECTURE);
        assertThat(entries, hasSize(1));
        assertThat(entries.get(0).uniqueId(), equalTo("real"));
    }

    @Test
    void handle_multiple_namespaces() throws IOException {
        Path ns1 = tempDir.resolve("ns1");
        Path ns2 = tempDir.resolve("ns2");
        Files.createDirectories(ns1.resolve("architectures"));
        Files.createDirectories(ns2.resolve("patterns"));
        Files.writeString(ns1.resolve("architectures/a.json"), "{\"unique-id\": \"a\", \"nodes\": []}");
        Files.writeString(ns2.resolve("patterns/p.json"), "{\"unique-id\": \"p\", \"nodes\": []}");

        registryService.rebuild(Map.of("team-a", ns1, "team-b", ns2));

        assertThat(registryService.listByType("team-a", RegistryResourceType.ARCHITECTURE), hasSize(1));
        assertThat(registryService.listByType("team-b", RegistryResourceType.PATTERN), hasSize(1));
        assertThat(registryService.listByType("team-a", RegistryResourceType.PATTERN), is(empty()));
    }

    @Test
    void rebuild_replaces_previous_snapshot_atomically() throws IOException {
        Path archDir = tempDir.resolve("architectures");
        Files.createDirectories(archDir);
        Files.writeString(archDir.resolve("v1.json"), "{\"unique-id\": \"v1\", \"nodes\": []}");

        registryService.rebuild(Map.of("finos", tempDir));
        assertThat(registryService.findByUniqueId("finos", "v1").isPresent(), is(true));

        Files.delete(archDir.resolve("v1.json"));
        Files.writeString(archDir.resolve("v2.json"), "{\"unique-id\": \"v2\", \"nodes\": []}");

        registryService.rebuild(Map.of("finos", tempDir));
        assertThat(registryService.findByUniqueId("finos", "v1").isPresent(), is(false));
        assertThat(registryService.findByUniqueId("finos", "v2").isPresent(), is(true));
    }

    @Test
    void skip_invalid_json_files_without_crashing() throws IOException {
        Path archDir = tempDir.resolve("architectures");
        Files.createDirectories(archDir);
        Files.writeString(archDir.resolve("bad.json"), "not json at all");
        Files.writeString(archDir.resolve("good.json"), "{\"unique-id\": \"good\", \"nodes\": []}");

        registryService.rebuild(Map.of("finos", tempDir));

        List<RegistryEntry> entries = registryService.listByType("finos", RegistryResourceType.ARCHITECTURE);
        assertThat(entries, hasSize(1));
        assertThat(entries.get(0).uniqueId(), equalTo("good"));
    }

    @Test
    void not_index_a_json_file_under_a_removed_guidelines_directory() throws IOException {
        // GUIDELINE was removed as a resource type (Office Hours, 2026-09-10, #3052) —
        // nothing served it, so files under guidelines/ are dropped entirely, not
        // reclassified.
        Path guideDir = tempDir.resolve("guidelines");
        Files.createDirectories(guideDir);
        Files.writeString(guideDir.resolve("best-practices.json"),
                "{\"unique-id\": \"best-practices\", \"title\": \"Best Practices\"}");

        registryService.rebuild(Map.of("finos", tempDir));

        assertThat(registryService.getSnapshot().listAll("finos"), empty());
    }

    @Test
    void detect_markdown_standards_in_nested_directories() throws IOException {
        Path stdDir = tempDir.resolve("standards/cloud/compute");
        Files.createDirectories(stdDir);
        Files.writeString(stdDir.resolve("vm-sizing.md"), "# VM Sizing Standard\n\nContent here.");
        Files.writeString(stdDir.resolve("README.md"), "# README\n\nIgnored.");

        registryService.rebuild(Map.of("finos", tempDir));

        List<RegistryEntry> entries = registryService.listByType("finos", RegistryResourceType.STANDARD);
        assertThat(entries, hasSize(1));
        assertThat(entries.get(0).uniqueId(), equalTo("vm-sizing"));
    }

    @Test
    void not_index_a_markdown_file_under_a_removed_guidelines_directory() throws IOException {
        Path guideDir = tempDir.resolve("guidelines/security");
        Files.createDirectories(guideDir);
        Files.writeString(guideDir.resolve("tls-policy.md"), "# TLS Policy\n\nAlways use TLS.");

        registryService.rebuild(Map.of("finos", tempDir));

        assertThat(registryService.getSnapshot().listAll("finos"), empty());
    }

    @Test
    void index_a_markdown_file_under_building_blocks_as_a_standard() throws IOException {
        // building-blocks/ is aliased to STANDARD (Office Hours, 2026-09-10, #3052).
        Path bbDir = tempDir.resolve("building-blocks");
        Files.createDirectories(bbDir);
        Files.writeString(bbDir.resolve("auth-block.md"), "# Auth Block\n\nDescribes the auth building block.");

        registryService.rebuild(Map.of("finos", tempDir));

        List<RegistryEntry> entries = registryService.listByType("finos", RegistryResourceType.STANDARD);
        assertThat(entries, hasSize(1));
        assertThat(entries.get(0).uniqueId(), equalTo("auth-block"));
    }

    @Test
    void merge_building_blocks_and_standards_entries_into_one_listing() throws IOException {
        Path stdDir = tempDir.resolve("standards");
        Files.createDirectories(stdDir);
        Files.writeString(stdDir.resolve("api-design.json"),
                "{\"unique-id\": \"api-design\", \"title\": \"API Design Standard\"}");

        Path bbDir = tempDir.resolve("building-blocks");
        Files.createDirectories(bbDir);
        Files.writeString(bbDir.resolve("auth-block.json"),
                "{\"unique-id\": \"auth-block\", \"title\": \"Auth Building Block\"}");

        registryService.rebuild(Map.of("finos", tempDir));

        List<RegistryEntry> entries = registryService.listByType("finos", RegistryResourceType.STANDARD);
        assertThat(entries, hasSize(2));
    }

    @Test
    void skip_markdown_files_outside_known_directories() throws IOException {
        Files.writeString(tempDir.resolve("README.md"), "# Project README");
        Path miscDir = tempDir.resolve("docs");
        Files.createDirectories(miscDir);
        Files.writeString(miscDir.resolve("notes.md"), "# Notes");

        registryService.rebuild(Map.of("finos", tempDir));

        List<RegistryEntry> entries = registryService.listByType("finos", RegistryResourceType.STANDARD);
        assertThat(entries, is(empty()));
    }

    @Test
    void return_empty_list_for_unknown_namespace() {
        registryService.rebuild(Map.of());
        List<RegistryEntry> entries = registryService.listByType("nonexistent", RegistryResourceType.ARCHITECTURE);
        assertThat(entries, is(empty()));
    }

    @Test
    void return_empty_optional_for_unknown_namespace_in_find() {
        registryService.rebuild(Map.of());
        Optional<RegistryEntry> result = registryService.findByUniqueId("nonexistent", "any-id");
        assertThat(result.isPresent(), is(false));
    }

    @Test
    void get_snapshot_returns_current_state() throws IOException {
        Path archDir = tempDir.resolve("architectures");
        Files.createDirectories(archDir);
        Files.writeString(archDir.resolve("test.json"), "{\"unique-id\": \"test\", \"nodes\": []}");

        registryService.rebuild(Map.of("ns", tempDir));

        RegistrySnapshot snapshot = registryService.getSnapshot();
        assertThat(snapshot.getNamespaces(), hasSize(1));
        assertThat(snapshot.listAll("ns"), hasSize(1));
    }

    @Test
    void handle_empty_directory_gracefully() throws IOException {
        Path emptyDir = tempDir.resolve("architectures");
        Files.createDirectories(emptyDir);

        registryService.rebuild(Map.of("finos", tempDir));

        List<RegistryEntry> entries = registryService.listByType("finos", RegistryResourceType.ARCHITECTURE);
        assertThat(entries, is(empty()));
    }

    @Test
    void handle_nonexistent_clone_path() {
        registryService.rebuild(Map.of("finos", tempDir.resolve("does-not-exist")));

        List<RegistryEntry> entries = registryService.listByType("finos", RegistryResourceType.ARCHITECTURE);
        assertThat(entries, is(empty()));
    }

    @Test
    void list_both_entries_by_type_even_when_their_fallback_derived_unique_ids_collide() throws IOException {
        // Two files in different subdirectories with the same basename, neither setting
        // its own "unique-id" - both fall back to "foo", colliding in the qualified-id
        // index. listByType (backed by the per-namespace list, not that index) must
        // still surface both.
        Path patternsA = tempDir.resolve("patterns/a");
        Path patternsB = tempDir.resolve("patterns/b");
        Files.createDirectories(patternsA);
        Files.createDirectories(patternsB);
        Files.writeString(patternsA.resolve("foo.json"), "{\"name\": \"Foo A\", \"nodes\": []}");
        Files.writeString(patternsB.resolve("foo.json"), "{\"name\": \"Foo B\", \"nodes\": []}");

        registryService.rebuild(Map.of("finos", tempDir));

        List<RegistryEntry> entries = registryService.listByType("finos", RegistryResourceType.PATTERN);
        assertThat(entries, hasSize(2));
    }

    @Test
    void resolve_a_colliding_unique_id_to_the_same_entry_deterministically_across_rebuilds() throws IOException {
        // findByUniqueId can only ever resolve one of the two colliding entries (that's
        // the known, tracked limitation - see the class javadoc on the index build).
        // What must hold is that repeated rebuilds of identical, unchanged content
        // resolve to the SAME one every time, not whichever the filesystem happened to
        // walk first.
        Path patternsA = tempDir.resolve("patterns/a");
        Path patternsB = tempDir.resolve("patterns/b");
        Files.createDirectories(patternsA);
        Files.createDirectories(patternsB);
        Files.writeString(patternsA.resolve("foo.json"), "{\"name\": \"Foo A\", \"nodes\": []}");
        Files.writeString(patternsB.resolve("foo.json"), "{\"name\": \"Foo B\", \"nodes\": []}");

        registryService.rebuild(Map.of("finos", tempDir));
        Optional<RegistryEntry> firstRebuild = registryService.findByUniqueId("finos", "foo");

        registryService.rebuild(Map.of("finos", tempDir));
        Optional<RegistryEntry> secondRebuild = registryService.findByUniqueId("finos", "foo");

        assertThat(firstRebuild.isPresent(), is(true));
        assertThat(secondRebuild, equalTo(firstRebuild));
        // Sorted by path ascending, then indexed in that order - the alphabetically
        // last path ("patterns/b/foo.json") is put into the map last, so it wins.
        assertThat(firstRebuild.get().filePath().toString(), equalTo("patterns/b/foo.json"));
    }
}
