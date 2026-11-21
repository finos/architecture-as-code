package org.finos.calm.store.github;

import org.finos.calm.domain.ResourceMapping;
import org.finos.calm.domain.ResourceType;
import org.finos.calm.domain.exception.GitHubWriteNotSupportedException;
import org.finos.calm.domain.exception.MappingNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.github.registry.RegistryResourceType;
import org.finos.calm.store.github.registry.ResourceRegistry;
import org.finos.calm.store.github.registry.RegistryEntry;
import org.finos.calm.store.github.registry.RegistrySnapshot;
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
class TestGitHubResourceMappingStoreShould {

    private static final String NAMESPACE = "finos";
    private static final String UNIQUE_ID = "my-architecture";

    @Mock
    private ResourceRegistry registryService;

    private GitHubResourceMappingStore store;

    @BeforeEach
    void setup() {
        store = new GitHubResourceMappingStore(registryService);
    }

    @Test
    void return_mapping_when_entry_exists_in_registry() throws Exception {
        RegistryEntry entry = createEntry(UNIQUE_ID, RegistryResourceType.ARCHITECTURE);
        setupNamespace();
        when(registryService.find(NAMESPACE, RegistryResourceType.ARCHITECTURE, UNIQUE_ID, null, null))
                .thenReturn(List.of(entry));

        ResourceMapping mapping = store.getMapping(NAMESPACE, ResourceType.ARCHITECTURE, UNIQUE_ID);

        assertThat(mapping.getNamespace(), equalTo(NAMESPACE));
        assertThat(mapping.getCustomId(), equalTo(UNIQUE_ID));
        assertThat(mapping.getResourceType(), equalTo(ResourceType.ARCHITECTURE));
        assertThat(mapping.getNumericId(), equalTo(ResourceMapping.NO_NUMERIC_ID));
    }

    @Test
    void throw_mapping_not_found_when_entry_missing() {
        setupNamespace();

        assertThrows(MappingNotFoundException.class,
                () -> store.getMapping(NAMESPACE, ResourceType.ARCHITECTURE, "nonexistent"));
    }

    @Test
    void throw_mapping_not_found_when_type_mismatch() {
        setupNamespace();
        when(registryService.find(NAMESPACE, RegistryResourceType.ARCHITECTURE, UNIQUE_ID, null, null))
                .thenReturn(List.of());

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
        RegistryEntry entry1 = createEntry("arch-one", RegistryResourceType.ARCHITECTURE);
        RegistryEntry entry2 = createEntry("arch-two", RegistryResourceType.ARCHITECTURE);
        setupNamespace();
        when(registryService.listByType(NAMESPACE, RegistryResourceType.ARCHITECTURE))
                .thenReturn(List.of(entry1, entry2));

        List<ResourceMapping> mappings = store.listMappings(NAMESPACE, ResourceType.ARCHITECTURE);

        assertThat(mappings, hasSize(2));
        assertThat(mappings.get(0).getCustomId(), equalTo("arch-one"));
        assertThat(mappings.get(1).getCustomId(), equalTo("arch-two"));
    }

    @Test
    void return_empty_list_when_no_entries_of_type() throws Exception {
        setupNamespace();
        when(registryService.listByType(NAMESPACE, RegistryResourceType.FLOW)).thenReturn(List.of());

        List<ResourceMapping> mappings = store.listMappings(NAMESPACE, ResourceType.FLOW);

        assertThat(mappings, hasSize(0));
    }

    @Test
    void throw_mapping_not_found_for_any_numeric_id() {
        setupNamespace();

        assertThrows(MappingNotFoundException.class,
                () -> store.getMappingByNumericId(NAMESPACE, ResourceType.ARCHITECTURE, 1));
    }

    @Test
    void return_empty_list_for_any_numeric_ids() throws Exception {
        setupNamespace();

        List<ResourceMapping> mappings = store.listMappingsByNumericIds(
                NAMESPACE, ResourceType.ARCHITECTURE, List.of(1));

        assertThat(mappings, hasSize(0));
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
    void throw_on_delete_mapping_by_numeric_id() {
        assertThrows(GitHubWriteNotSupportedException.class,
                () -> store.deleteMappingByNumericId(NAMESPACE, ResourceType.ARCHITECTURE, 1));
    }

    @Test
    void map_all_resource_types_correctly() {
        assertThat(GitHubResourceMappingStore.toRegistryResourceType(ResourceType.PATTERN), equalTo(RegistryResourceType.PATTERN));
        assertThat(GitHubResourceMappingStore.toRegistryResourceType(ResourceType.ARCHITECTURE), equalTo(RegistryResourceType.ARCHITECTURE));
        assertThat(GitHubResourceMappingStore.toRegistryResourceType(ResourceType.FLOW), equalTo(RegistryResourceType.FLOW));
        assertThat(GitHubResourceMappingStore.toRegistryResourceType(ResourceType.STANDARD), equalTo(RegistryResourceType.STANDARD));
        assertThat(GitHubResourceMappingStore.toRegistryResourceType(ResourceType.INTERFACE), equalTo(RegistryResourceType.INTERFACE));
        assertThat(GitHubResourceMappingStore.toRegistryResourceType(ResourceType.TIMELINE), equalTo(RegistryResourceType.TIMELINE));
    }

    private RegistryEntry createEntry(String uniqueId, RegistryResourceType type) {
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
                Map.of(NAMESPACE, List.of()));
        when(registryService.getSnapshot()).thenReturn(snapshot);
    }
}
