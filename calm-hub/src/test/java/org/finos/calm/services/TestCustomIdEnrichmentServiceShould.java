package org.finos.calm.services;

import org.finos.calm.domain.ResourceMapping;
import org.finos.calm.domain.ResourceType;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.interfaces.NamespaceInterfaceSummary;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.store.ResourceMappingStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestCustomIdEnrichmentServiceShould {

    private static final String NAMESPACE = "finos";

    @Mock
    ResourceMappingStore mappingStore;

    private CustomIdEnrichmentService service;

    @BeforeEach
    void setup() {
        service = new CustomIdEnrichmentService(mappingStore);
    }

    private static ResourceMapping mapping(String customId, ResourceType type, int numericId) {
        return new ResourceMapping.ResourceMappingBuilder()
                .setNamespace(NAMESPACE)
                .setCustomId(customId)
                .setResourceType(type)
                .setNumericId(numericId)
                .build();
    }

    @Test
    void set_the_custom_id_on_every_summary_that_has_a_mapping() throws Exception {
        List<NamespaceResourceSummary> summaries = Arrays.asList(
                new NamespaceResourceSummary("Sample Architecture", "First", 1, 3),
                new NamespaceResourceSummary("TraderX", "Second", 3, 1)
        );
        when(mappingStore.listMappingsByNumericIds(NAMESPACE, ResourceType.ARCHITECTURE, List.of(1, 3)))
                .thenReturn(List.of(
                        mapping("sample-architecture", ResourceType.ARCHITECTURE, 1),
                        mapping("traderx", ResourceType.ARCHITECTURE, 3)));

        List<NamespaceResourceSummary> enriched =
                service.enrich(NAMESPACE, ResourceType.ARCHITECTURE, summaries);

        assertEquals("sample-architecture", enriched.get(0).getCustomId());
        assertEquals("traderx", enriched.get(1).getCustomId());
    }

    @Test
    void leave_the_custom_id_null_for_a_summary_with_no_mapping() throws Exception {
        List<NamespaceResourceSummary> summaries = Arrays.asList(
                new NamespaceResourceSummary("Mapped", "Has a custom ID", 1, 1),
                new NamespaceResourceSummary("Unmapped", "Created via the numeric API", 2, 1)
        );
        when(mappingStore.listMappingsByNumericIds(NAMESPACE, ResourceType.PATTERN, List.of(1, 2)))
                .thenReturn(List.of(mapping("api-gateway-pattern", ResourceType.PATTERN, 1)));

        service.enrich(NAMESPACE, ResourceType.PATTERN, summaries);

        assertEquals("api-gateway-pattern", summaries.get(0).getCustomId());
        assertNull(summaries.get(1).getCustomId());
    }

    @Test
    void enrich_interface_summaries_through_the_same_path() throws Exception {
        List<NamespaceInterfaceSummary> summaries =
                List.of(new NamespaceInterfaceSummary("Host Port", "A host/port interface", 7));
        when(mappingStore.listMappingsByNumericIds(NAMESPACE, ResourceType.INTERFACE, List.of(7)))
                .thenReturn(List.of(mapping("host-port", ResourceType.INTERFACE, 7)));

        service.enrich(NAMESPACE, ResourceType.INTERFACE, summaries);

        assertEquals("host-port", summaries.get(0).getCustomId());
    }

    @Test
    void keep_the_first_custom_id_when_two_map_to_the_same_numeric_id() throws Exception {
        List<NamespaceResourceSummary> summaries =
                List.of(new NamespaceResourceSummary("Sample", "Aliased", 1, 1));
        when(mappingStore.listMappingsByNumericIds(NAMESPACE, ResourceType.ARCHITECTURE, List.of(1)))
                .thenReturn(List.of(
                        mapping("first-custom-id", ResourceType.ARCHITECTURE, 1),
                        mapping("second-custom-id", ResourceType.ARCHITECTURE, 1)));

        service.enrich(NAMESPACE, ResourceType.ARCHITECTURE, summaries);

        assertEquals("first-custom-id", summaries.get(0).getCustomId());
    }

    @Test
    void skip_a_mapping_with_no_custom_id_without_losing_the_rest_of_the_page() throws Exception {
        List<NamespaceResourceSummary> summaries = Arrays.asList(
                new NamespaceResourceSummary("Malformed", "Mapping row with no customId", 1, 1),
                new NamespaceResourceSummary("Fine", "Ordinary mapping", 2, 1)
        );
        when(mappingStore.listMappingsByNumericIds(NAMESPACE, ResourceType.ARCHITECTURE, List.of(1, 2)))
                .thenReturn(List.of(
                        mapping(null, ResourceType.ARCHITECTURE, 1),
                        mapping("fine", ResourceType.ARCHITECTURE, 2)));

        service.enrich(NAMESPACE, ResourceType.ARCHITECTURE, summaries);

        assertNull(summaries.get(0).getCustomId());
        assertEquals("fine", summaries.get(1).getCustomId());
    }

    @Test
    void not_query_the_mapping_store_for_an_empty_list() throws Exception {
        List<NamespaceResourceSummary> summaries = List.of();

        assertSame(summaries, service.enrich(NAMESPACE, ResourceType.FLOW, summaries));

        verifyNoInteractions(mappingStore);
    }

    @Test
    void return_null_unchanged_when_given_null() {
        assertNull(service.enrich(NAMESPACE, ResourceType.FLOW, null));

        verifyNoInteractions(mappingStore);
    }

    @Test
    void not_query_the_mapping_store_when_every_summary_has_a_null_id() throws Exception {
        List<NamespaceResourceSummary> summaries =
                List.of(new NamespaceResourceSummary("No ID", "Unstored", null, 0));

        service.enrich(NAMESPACE, ResourceType.STANDARD, summaries);

        verify(mappingStore, never()).listMappingsByNumericIds(anyString(), any(), anyList());
        assertNull(summaries.get(0).getCustomId());
    }

    @Test
    void omit_null_ids_from_the_lookup_but_still_enrich_the_rest() throws Exception {
        List<NamespaceResourceSummary> summaries = Arrays.asList(
                new NamespaceResourceSummary("No ID", "Unstored", null, 0),
                new NamespaceResourceSummary("Has ID", "Stored", 4, 1)
        );
        when(mappingStore.listMappingsByNumericIds(NAMESPACE, ResourceType.STANDARD, List.of(4)))
                .thenReturn(List.of(mapping("a-standard", ResourceType.STANDARD, 4)));

        service.enrich(NAMESPACE, ResourceType.STANDARD, summaries);

        assertNull(summaries.get(0).getCustomId());
        assertEquals("a-standard", summaries.get(1).getCustomId());
    }

    @Test
    void return_summaries_unenriched_when_the_mapping_store_reports_an_unknown_namespace() throws Exception {
        List<NamespaceResourceSummary> summaries =
                new ArrayList<>(List.of(new NamespaceResourceSummary("Sample", "First", 1, 1)));
        when(mappingStore.listMappingsByNumericIds(anyString(), any(), anyList()))
                .thenThrow(new NamespaceNotFoundException());

        List<NamespaceResourceSummary> enriched =
                service.enrich(NAMESPACE, ResourceType.ARCHITECTURE, summaries);

        assertSame(summaries, enriched);
        assertNull(enriched.get(0).getCustomId());
    }

    @Test
    void return_summaries_unenriched_when_the_mapping_store_throws_at_runtime() throws Exception {
        List<NamespaceResourceSummary> summaries =
                new ArrayList<>(List.of(new NamespaceResourceSummary("Sample", "First", 1, 1)));
        when(mappingStore.listMappingsByNumericIds(anyString(), any(), anyList()))
                .thenThrow(new IllegalStateException("mapping collection unavailable"));

        List<NamespaceResourceSummary> enriched =
                service.enrich(NAMESPACE, ResourceType.ARCHITECTURE, summaries);

        assertSame(summaries, enriched);
        assertNull(enriched.get(0).getCustomId());
    }

    @Test
    void query_the_mapping_store_once_for_the_whole_page() throws Exception {
        List<NamespaceResourceSummary> summaries = Arrays.asList(
                new NamespaceResourceSummary("One", "First", 1, 1),
                new NamespaceResourceSummary("Two", "Second", 2, 1),
                new NamespaceResourceSummary("Three", "Third", 3, 1)
        );
        when(mappingStore.listMappingsByNumericIds(anyString(), any(), anyList())).thenReturn(List.of());

        service.enrich(NAMESPACE, ResourceType.ARCHITECTURE, summaries);

        verify(mappingStore).listMappingsByNumericIds(
                eq(NAMESPACE), eq(ResourceType.ARCHITECTURE), eq(List.of(1, 2, 3)));
    }
}
