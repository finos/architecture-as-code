package org.finos.calm.store.github;

import org.finos.calm.domain.ResourceMapping;
import org.finos.calm.domain.ResourceType;
import org.finos.calm.domain.exception.GitHubWriteNotSupportedException;
import org.finos.calm.domain.exception.MappingNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
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
import java.util.Optional;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestGitHubResourceMappingStoreShould {

    private static final String NAMESPACE = "finos";
    private static final String UNIQUE_ID = "my-architecture";
    private static final int NUMERIC_ID = UNIQUE_ID.hashCode() & 0x7FFFFFFF;

    @Mock
    private InMemoryRegistryService registryService;

    private GitHubResourceMappingStore store;

    @BeforeEach
    void setup() {
        store = new GitHubResourceMappingStore(registryService);
    }

    @Test
    void return_mapping_when_entry_exists_in_registry() throws Exception {
        RegistryEntry entry = createEntry(UNIQUE_ID, CalmResourceType.ARCHITECTURE);
        setupNamespaceWithEntry(entry);
        when(registryService.findByUniqueId(NAMESPACE, UNIQUE_ID)).thenReturn(Optional.of(entry));

        ResourceMapping mapping = store.getMapping(NAMESPACE, ResourceType.ARCHITECTURE, UNIQUE_ID);

        assertThat(mapping.getNamespace(), equalTo(NAMESPACE));
        assertThat(mapping.getCustomId(), equalTo(UNIQUE_ID));
        assertThat(mapping.getResourceType(), equalTo(ResourceType.ARCHITECTURE));
        assertThat(mapping.getNumericId(), equalTo(NUMERIC_ID));
    }

    @Test
    void throw_mapping_not_found_when_entry_missing() {
        setupNamespace();
        when(registryService.findByUniqueId(NAMESPACE, "nonexistent")).thenReturn(Optional.empty());

        assertThrows(MappingNotFoundException.class,
                () -> store.getMapping(NAMESPACE, ResourceType.ARCHITECTURE, "nonexistent"));
    }

    @Test
    void throw_mapping_not_found_when_type_mismatch() {
        RegistryEntry entry = createEntry(UNIQUE_ID, CalmResourceType.PATTERN);
        setupNamespaceWithEntry(entry);
        when(registryService.findByUniqueId(NAMESPACE, UNIQUE_ID)).thenReturn(Optional.of(entry));

        assertThrows(MappingNotFoundException.class,
                () -> store.getMapping(NAMESPACE, ResourceType.ARCHITECTURE, UNIQUE_ID));
    }

    @Test
    void throw_namespace_not_found_when_namespace_unknown() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.getMapping("nonexistent", ResourceType.ARCHITECTURE, UNIQUE_ID));
    }

    @Test
    void list_mappings_for_namespace_and_type() throws Exception {
        RegistryEntry entry1 = createEntry("arch-one", CalmResourceType.ARCHITECTURE);
        RegistryEntry entry2 = createEntry("arch-two", CalmResourceType.ARCHITECTURE);
        setupNamespace();
        when(registryService.listByType(NAMESPACE, CalmResourceType.ARCHITECTURE))
                .thenReturn(List.of(entry1, entry2));

        List<ResourceMapping> mappings = store.listMappings(NAMESPACE, ResourceType.ARCHITECTURE);

        assertThat(mappings, hasSize(2));
        assertThat(mappings.get(0).getCustomId(), equalTo("arch-one"));
        assertThat(mappings.get(1).getCustomId(), equalTo("arch-two"));
    }

    @Test
    void return_empty_list_when_no_entries_of_type() throws Exception {
        setupNamespace();
        when(registryService.listByType(NAMESPACE, CalmResourceType.FLOW)).thenReturn(List.of());

        List<ResourceMapping> mappings = store.listMappings(NAMESPACE, ResourceType.FLOW);

        assertThat(mappings, hasSize(0));
    }

    @Test
    void get_mapping_by_numeric_id() throws Exception {
        RegistryEntry entry = createEntry(UNIQUE_ID, CalmResourceType.ARCHITECTURE);
        setupNamespace();
        when(registryService.listByType(NAMESPACE, CalmResourceType.ARCHITECTURE))
                .thenReturn(List.of(entry));

        ResourceMapping mapping = store.getMappingByNumericId(NAMESPACE, ResourceType.ARCHITECTURE, NUMERIC_ID);

        assertThat(mapping.getCustomId(), equalTo(UNIQUE_ID));
        assertThat(mapping.getNumericId(), equalTo(NUMERIC_ID));
    }

    @Test
    void throw_mapping_not_found_for_unknown_numeric_id() {
        setupNamespace();
        when(registryService.listByType(NAMESPACE, CalmResourceType.ARCHITECTURE)).thenReturn(List.of());

        assertThrows(MappingNotFoundException.class,
                () -> store.getMappingByNumericId(NAMESPACE, ResourceType.ARCHITECTURE, 99999));
    }

    @Test
    void list_mappings_by_numeric_ids() throws Exception {
        RegistryEntry entry1 = createEntry("arch-one", CalmResourceType.ARCHITECTURE);
        RegistryEntry entry2 = createEntry("arch-two", CalmResourceType.ARCHITECTURE);
        setupNamespace();
        when(registryService.listByType(NAMESPACE, CalmResourceType.ARCHITECTURE))
                .thenReturn(List.of(entry1, entry2));

        int id1 = "arch-one".hashCode() & 0x7FFFFFFF;
        List<ResourceMapping> mappings = store.listMappingsByNumericIds(
                NAMESPACE, ResourceType.ARCHITECTURE, List.of(id1));

        assertThat(mappings, hasSize(1));
        assertThat(mappings.get(0).getCustomId(), equalTo("arch-one"));
    }

    @Test
    void throw_on_create_mapping() {
        assertThrows(GitHubWriteNotSupportedException.class,
                () -> store.createMapping(NAMESPACE, UNIQUE_ID, ResourceType.ARCHITECTURE, 1));
    }

    @Test
    void throw_on_update_mapping_numeric_id() {
        assertThrows(GitHubWriteNotSupportedException.class,
                () -> store.updateMappingNumericId(NAMESPACE, ResourceType.ARCHITECTURE, UNIQUE_ID, 1));
    }

    @Test
    void throw_on_delete_mapping() {
        assertThrows(GitHubWriteNotSupportedException.class,
                () -> store.deleteMapping(NAMESPACE, ResourceType.ARCHITECTURE, UNIQUE_ID));
    }

    @Test
    void map_all_resource_types_correctly() {
        assertThat(GitHubResourceMappingStore.toCalmResourceType(ResourceType.PATTERN), equalTo(CalmResourceType.PATTERN));
        assertThat(GitHubResourceMappingStore.toCalmResourceType(ResourceType.ARCHITECTURE), equalTo(CalmResourceType.ARCHITECTURE));
        assertThat(GitHubResourceMappingStore.toCalmResourceType(ResourceType.FLOW), equalTo(CalmResourceType.FLOW));
        assertThat(GitHubResourceMappingStore.toCalmResourceType(ResourceType.STANDARD), equalTo(CalmResourceType.STANDARD));
        assertThat(GitHubResourceMappingStore.toCalmResourceType(ResourceType.INTERFACE), equalTo(CalmResourceType.INTERFACE));
        assertThat(GitHubResourceMappingStore.toCalmResourceType(ResourceType.BUILDING_BLOCK), equalTo(CalmResourceType.BUILDING_BLOCK));
    }

    private RegistryEntry createEntry(String uniqueId, CalmResourceType type) {
        String folder = switch (type) {
            case ARCHITECTURE -> "architectures";
            case PATTERN -> "patterns";
            case FLOW -> "flows";
            case STANDARD -> "standards";
            case INTERFACE -> "interfaces";
            default -> "other";
        };
        return new RegistryEntry(uniqueId, Path.of(folder + "/" + uniqueId + ".json"),
                type, uniqueId.replace("-", " "), Instant.now());
    }

    private void setupNamespace() {
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of(NAMESPACE, List.of()),
                Map.of(),
                Map.of()
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
    }

    private void setupNamespaceWithEntry(RegistryEntry entry) {
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of(NAMESPACE, List.of(entry)),
                Map.of(NAMESPACE + ":" + entry.uniqueId(), entry),
                Map.of(entry.type(), List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
    }
}
