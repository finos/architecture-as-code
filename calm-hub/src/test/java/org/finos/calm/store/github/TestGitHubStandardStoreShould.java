package org.finos.calm.store.github;

import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.domain.standards.CreateStandardRequest;
import org.finos.calm.store.github.util.CalmResourceType;
import org.finos.calm.store.github.util.InMemoryRegistryService;
import org.finos.calm.store.github.util.RegistryEntry;
import org.finos.calm.store.github.util.RegistrySnapshot;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestGitHubStandardStoreShould {

    @Mock
    private InMemoryRegistryService registryService;

    private GitHubStandardStore store;

    @BeforeEach
    void setup() {
        store = new GitHubStandardStore(registryService);
    }

    @Test
    void return_standards_for_namespace() throws NamespaceNotFoundException {
        RegistryEntry entry = new RegistryEntry("naming-convention", Path.of("standards/naming-convention.json"),
                CalmResourceType.STANDARD, "Naming Convention", Instant.now());

        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:naming-convention", entry),
                Map.of(CalmResourceType.STANDARD, List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", CalmResourceType.STANDARD)).thenReturn(List.of(entry));

        List<NamespaceResourceSummary> result = store.getStandardsForNamespace("finos");

        assertThat(result, hasSize(1));
        assertThat(result.get(0).getName(), equalTo("Naming Convention"));
    }

    @Test
    void throw_namespace_not_found_when_namespace_missing() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.getStandardsForNamespace("nonexistent"));
    }

    @Test
    void throw_unsupported_on_create_standard() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.createStandardForNamespace(new CreateStandardRequest(), "finos"));
    }

    @Test
    void throw_standard_not_found_when_id_does_not_match() throws NamespaceNotFoundException {
        RegistryEntry entry = new RegistryEntry("std-x", java.nio.file.Path.of("standards/x.json"),
                CalmResourceType.STANDARD, "X", java.time.Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                java.util.Map.of("finos", java.util.List.of(entry)),
                java.util.Map.of("finos:std-x", entry),
                java.util.Map.of(CalmResourceType.STANDARD, java.util.List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", CalmResourceType.STANDARD)).thenReturn(java.util.List.of(entry));

        assertThrows(org.finos.calm.domain.exception.StandardNotFoundException.class,
                () -> store.getStandardVersions("finos", 99999));
    }

    @Test
    void throw_namespace_not_found_on_get_standard_versions() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);
        assertThrows(NamespaceNotFoundException.class,
                () -> store.getStandardVersions("nonexistent", 1));
    }

    @Test
    void throw_namespace_not_found_on_get_standard_for_version() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);
        assertThrows(NamespaceNotFoundException.class,
                () -> store.getStandardForVersion("nonexistent", 1, "latest"));
    }

    @Test
    void return_versions_for_existing_standard() throws Exception {
        RegistryEntry entry = new RegistryEntry("std-1", java.nio.file.Path.of("standards/std.json"),
                CalmResourceType.STANDARD, "Std", java.time.Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                java.util.Map.of("finos", java.util.List.of(entry)),
                java.util.Map.of("finos:std-1", entry),
                java.util.Map.of(CalmResourceType.STANDARD, java.util.List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", CalmResourceType.STANDARD)).thenReturn(java.util.List.of(entry));

        int hashId = Math.abs("std-1".hashCode());
        java.util.List<String> versions = store.getStandardVersions("finos", hashId);
        assertThat(versions, hasSize(1));
        assertThat(versions.get(0), equalTo("latest"));
    }

    @Test
    void return_content_for_standard(@org.junit.jupiter.api.io.TempDir java.nio.file.Path tempDir) throws Exception {
        java.nio.file.Path stdDir = tempDir.resolve("finos/standards");
        java.nio.file.Files.createDirectories(stdDir);
        java.nio.file.Files.writeString(stdDir.resolve("test.json"), "{\"name\":\"Test Standard\"}");

        RegistryEntry entry = new RegistryEntry("test-std", java.nio.file.Path.of("standards/test.json"),
                CalmResourceType.STANDARD, "Test", java.time.Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                java.util.Map.of("finos", java.util.List.of(entry)),
                java.util.Map.of("finos:test-std", entry),
                java.util.Map.of(CalmResourceType.STANDARD, java.util.List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", CalmResourceType.STANDARD)).thenReturn(java.util.List.of(entry));

        store.cloneDirectory = tempDir.toString();
        int hashId = Math.abs("test-std".hashCode());
        String content = store.getStandardForVersion("finos", hashId, "latest");
        assertThat(content, equalTo("{\"name\":\"Test Standard\"}"));
    }

    @Test
    void prefer_md_sibling_over_json(@org.junit.jupiter.api.io.TempDir java.nio.file.Path tempDir) throws Exception {
        java.nio.file.Path stdDir = tempDir.resolve("finos/standards");
        java.nio.file.Files.createDirectories(stdDir);
        java.nio.file.Files.writeString(stdDir.resolve("policy.guideline.json"), "{\"nodes\":[]}");
        java.nio.file.Files.writeString(stdDir.resolve("policy.md"), "# Policy\n\nContent here.");

        RegistryEntry entry = new RegistryEntry("policy", java.nio.file.Path.of("standards/policy.guideline.json"),
                CalmResourceType.STANDARD, "Policy", java.time.Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                java.util.Map.of("finos", java.util.List.of(entry)),
                java.util.Map.of("finos:policy", entry),
                java.util.Map.of(CalmResourceType.STANDARD, java.util.List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", CalmResourceType.STANDARD)).thenReturn(java.util.List.of(entry));

        store.cloneDirectory = tempDir.toString();
        int hashId = Math.abs("policy".hashCode());
        String content = store.getStandardForVersion("finos", hashId, "latest");
        assertThat(content, org.hamcrest.Matchers.startsWith("# Policy"));
    }

    @Test
    void throw_unsupported_on_create_standard_for_version() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.createStandardForVersion(new CreateStandardRequest(), "finos", 1, "1.0.0"));
    }
}
