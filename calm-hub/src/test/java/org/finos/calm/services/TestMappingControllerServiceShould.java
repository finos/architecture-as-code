package org.finos.calm.services;

import jakarta.ws.rs.core.Response;
import org.finos.calm.domain.ResourceMapping;
import org.finos.calm.domain.ResourceType;
import org.finos.calm.domain.adr.Adr;
import org.finos.calm.domain.adr.AdrMeta;
import org.finos.calm.domain.adr.Status;
import org.finos.calm.domain.exception.AdrNotFoundException;
import org.finos.calm.domain.exception.MappingNotFoundException;
import org.finos.calm.resources.CalmDocumentParser;
import org.finos.calm.store.AdrStore;
import org.finos.calm.store.ArchitectureStore;
import org.finos.calm.store.ControlStore;
import org.finos.calm.store.DomainStore;
import org.finos.calm.store.FlowStore;
import org.finos.calm.store.InterfaceStore;
import org.finos.calm.store.PatternStore;
import org.finos.calm.store.ResourceMappingStore;
import org.finos.calm.store.StandardStore;
import org.finos.calm.store.TimelineStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * The ADR arms of {@link MappingControllerService}'s per-type dispatch. The name-based ADR
 * routes never reach the generic semver paths, so these are exercised directly.
 */
@ExtendWith(MockitoExtension.class)
class TestMappingControllerServiceShould {

    private static final String NAMESPACE = "finos";

    @Mock private ResourceMappingStore mockMappingStore;
    @Mock private PatternStore mockPatternStore;
    @Mock private ArchitectureStore mockArchitectureStore;
    @Mock private FlowStore mockFlowStore;
    @Mock private StandardStore mockStandardStore;
    @Mock private InterfaceStore mockInterfaceStore;
    @Mock private TimelineStore mockTimelineStore;
    @Mock private DomainStore mockDomainStore;
    @Mock private ControlStore mockControlStore;
    @Mock private AdrStore mockAdrStore;

    private MappingControllerService service;

    @BeforeEach
    void setup() {
        service = new MappingControllerService(mockMappingStore, mockPatternStore, mockArchitectureStore, mockFlowStore,
                mockStandardStore, mockInterfaceStore, mockTimelineStore, mockDomainStore, mockControlStore, mockAdrStore,
                new CalmDocumentParser());
    }

    private static ResourceMapping adrMapping() {
        return new ResourceMapping.ResourceMappingBuilder().setNamespace(NAMESPACE).setCustomId("use-kafka")
                .setResourceType(ResourceType.ADR).setNumericId(7).build();
    }

    @Test
    void resolve_an_adr_mapping_from_the_adr_store() throws Exception {
        when(mockAdrStore.getAdrIdBySlug(NAMESPACE, "use-kafka")).thenReturn(7);

        ResourceMapping mapping = service.getMapping(NAMESPACE, ResourceType.ADR, "use-kafka");

        assertThat(mapping.getNumericId(), is(7));
        assertThat(mapping.getResourceType(), is(ResourceType.ADR));
        verifyNoInteractions(mockMappingStore);
    }

    @Test
    void report_an_unknown_adr_slug_as_a_missing_mapping() throws Exception {
        when(mockAdrStore.getAdrIdBySlug(NAMESPACE, "missing")).thenThrow(new AdrNotFoundException());

        assertThrows(MappingNotFoundException.class, () -> service.getMapping(NAMESPACE, ResourceType.ADR, "missing"));
    }

    @Test
    void list_adr_versions_and_read_one_as_an_adr_document() throws Exception {
        when(mockAdrStore.getAdrVersions(NAMESPACE, 7)).thenReturn(List.of("1", "2"));
        Adr adr = new Adr.AdrBuilder().setTitle("Use Kafka").setStatus(Status.accepted).build();
        when(mockAdrStore.getAdrForVersion(NAMESPACE, 7, "2"))
                .thenReturn(new AdrMeta.AdrMetaBuilder().setNamespace(NAMESPACE).setId(7).setAdr(adr).build());

        assertThat(service.getVersionsForMapping(adrMapping()), contains("1", "2"));
        assertThat(service.getResourceJsonForVersion(adrMapping(), "2"),
                is("{\"slug\":\"use-kafka\",\"title\":\"Use Kafka\",\"status\":\"accepted\"}"));
    }

    @Test
    void refuse_an_adr_on_the_semver_create_path() throws Exception {
        Response response = service.createOrAddVersion(NAMESPACE, ResourceType.ADR, "use-kafka", "{}",
                new CalmDocumentParser.VersionSpec("1.0.0", true));

        assertThat(response.getStatus(), is(400));
        assertThat(response.getEntity(), is(CalmDocumentParser.ADR_WRITE_MESSAGE));
        verifyNoInteractions(mockMappingStore, mockAdrStore);
    }

    @Test
    void refuse_an_adr_on_the_update_in_place_path() throws Exception {
        Response response = service.updateVersionedResource(ResourceType.ADR, NAMESPACE, "use-kafka", 7,
                "1.0.0", "T", "", "{}");

        assertThat(response.getStatus(), is(500));
        verifyNoInteractions(mockAdrStore);
    }
}
