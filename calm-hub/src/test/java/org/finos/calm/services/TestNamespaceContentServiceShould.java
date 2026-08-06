package org.finos.calm.services;

import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.store.AdrStore;
import org.finos.calm.store.ArchitectureStore;
import org.finos.calm.store.DecoratorStore;
import org.finos.calm.store.FlowStore;
import org.finos.calm.store.InterfaceStore;
import org.finos.calm.store.PatternStore;
import org.finos.calm.store.StandardStore;
import org.finos.calm.store.TimelineStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestNamespaceContentServiceShould {

    private static final String NAMESPACE = "finos";

    @Mock
    ArchitectureStore mockArchitectureStore;
    @Mock
    PatternStore mockPatternStore;
    @Mock
    FlowStore mockFlowStore;
    @Mock
    StandardStore mockStandardStore;
    @Mock
    AdrStore mockAdrStore;
    @Mock
    InterfaceStore mockInterfaceStore;
    @Mock
    TimelineStore mockTimelineStore;
    @Mock
    DecoratorStore mockDecoratorStore;

    NamespaceContentService service;

    @BeforeEach
    void setUp() {
        service = new NamespaceContentService(
                mockArchitectureStore, mockPatternStore, mockFlowStore, mockStandardStore,
                mockAdrStore, mockInterfaceStore, mockTimelineStore, mockDecoratorStore);
    }

    @Test
    void return_false_when_namespace_has_no_content_in_any_store() throws Exception {
        assertThat(service.hasContent(NAMESPACE), is(false));

        verify(mockArchitectureStore).getArchitecturesForNamespace(NAMESPACE);
        verify(mockPatternStore).getPatternsForNamespace(NAMESPACE);
        verify(mockFlowStore).getFlowsForNamespace(NAMESPACE);
        verify(mockStandardStore).getStandardsForNamespace(NAMESPACE);
        verify(mockAdrStore).countAdrsForNamespace(NAMESPACE);
        verify(mockInterfaceStore).getInterfacesForNamespace(NAMESPACE);
        verify(mockTimelineStore).getTimelinesForNamespace(NAMESPACE);
        verify(mockDecoratorStore).getDecoratorsForNamespace(NAMESPACE, null, null);
    }

    @Test
    void return_true_and_short_circuit_when_architecture_store_has_content() throws Exception {
        when(mockArchitectureStore.getArchitecturesForNamespace(NAMESPACE))
                .thenReturn(List.of(new NamespaceResourceSummary("a1", "desc", 1, 0)));

        assertThat(service.hasContent(NAMESPACE), is(true));

        verify(mockPatternStore, never()).getPatternsForNamespace(NAMESPACE);
        verify(mockDecoratorStore, never()).getDecoratorsForNamespace(NAMESPACE, null, null);
    }

    @Test
    void return_true_when_only_the_last_checked_store_has_content() throws Exception {
        when(mockDecoratorStore.getDecoratorsForNamespace(NAMESPACE, null, null))
                .thenReturn(List.of(1));

        assertThat(service.hasContent(NAMESPACE), is(true));

        verify(mockArchitectureStore).getArchitecturesForNamespace(NAMESPACE);
        verify(mockTimelineStore).getTimelinesForNamespace(NAMESPACE);
    }

    @Test
    void return_true_when_only_the_adr_store_has_content() throws Exception {
        when(mockAdrStore.countAdrsForNamespace(NAMESPACE)).thenReturn(3);

        // ADR is checked by count rather than by listing, so its true path needs its own
        // cover — this gates an irreversible namespace delete.
        assertThat(service.hasContent(NAMESPACE), is(true));
    }

    @Test
    void treat_namespace_not_found_from_the_adr_store_as_empty() throws Exception {
        when(mockAdrStore.countAdrsForNamespace(NAMESPACE))
                .thenThrow(new NamespaceNotFoundException());

        assertThat(service.hasContent(NAMESPACE), is(false));
    }

    @Test
    void propagate_a_runtime_failure_from_the_adr_store_instead_of_treating_it_as_empty() throws Exception {
        when(mockAdrStore.countAdrsForNamespace(NAMESPACE))
                .thenThrow(new RuntimeException("store unavailable"));

        // Deliberately unlike CountsService: reporting "no content" for content that was
        // never confirmed absent would let the delete proceed.
        assertThrows(RuntimeException.class, () -> service.hasContent(NAMESPACE));
    }

    @Test
    void treat_namespace_not_found_from_a_store_as_empty() throws Exception {
        when(mockArchitectureStore.getArchitecturesForNamespace(NAMESPACE))
                .thenThrow(new NamespaceNotFoundException());

        assertThat(service.hasContent(NAMESPACE), is(false));
    }

    @Test
    void propagate_a_runtime_failure_from_a_store_instead_of_treating_it_as_empty() throws Exception {
        when(mockArchitectureStore.getArchitecturesForNamespace(NAMESPACE))
                .thenThrow(new RuntimeException("store unavailable"));

        assertThrows(RuntimeException.class, () -> service.hasContent(NAMESPACE));
    }
}
