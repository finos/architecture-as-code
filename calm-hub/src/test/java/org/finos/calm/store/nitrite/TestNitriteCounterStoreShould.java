package org.finos.calm.store.nitrite;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.DocumentCursor;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.filters.Filter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
public class TestNitriteCounterStoreShould {

    private static final String PATTERN_COUNTER = "pattern_counter";
    private static final String ARCHITECTURE_COUNTER = "architecture_counter";
    private static final String ADR_COUNTER = "adr_counter";
    private static final String FLOW_COUNTER = "flow_counter";
    private static final String TIMELINE_COUNTER = "timeline_counter";
    private static final String DECORATOR_COUNTER = "decorator_counter";
    private static final String INTERFACE_COUNTER = "interface_counter";
    private static final String DOCUMENT_COUNTER = "document_counter";

    @Mock private Nitrite mockDb;

    @Mock private NitriteCollection mockCollection;

    @Mock private DocumentCursor mockCursor;

    private NitriteCounterStore counterStore;

    @BeforeEach
    public void setup() {
        when(mockDb.getCollection("counters")).thenReturn(mockCollection);
        counterStore = new NitriteCounterStore(mockDb);
    }

    @Test
    public void testGetNextPatternSequenceValue() {
        // Arrange
        Document countersDoc = mock(Document.class);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.firstOrNull()).thenReturn(countersDoc);
        when(countersDoc.get(PATTERN_COUNTER, Integer.class)).thenReturn(5); // Current value

        // Act
        int result = counterStore.getNextPatternSequenceValue();

        // Assert
        assertThat(result, is(6));
        verify(countersDoc).put(PATTERN_COUNTER, 6); // Verify the counter was incremented
        verify(mockCollection).update(countersDoc); // Verify the document was updated
    }

    @Test
    public void testGetNextArchitectureSequenceValue() {
        // Arrange
        Document countersDoc = mock(Document.class);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.firstOrNull()).thenReturn(countersDoc);
        when(countersDoc.get(ARCHITECTURE_COUNTER, Integer.class)).thenReturn(10); // Current value

        // Act
        int result = counterStore.getNextArchitectureSequenceValue();

        // Assert
        assertThat(result, is(11));
        verify(countersDoc).put(ARCHITECTURE_COUNTER, 11); // Verify the counter was incremented
        verify(mockCollection).update(countersDoc); // Verify the document was updated
    }

    @Test
    public void testGetNextAdrSequenceValue() {
        // Arrange
        Document countersDoc = mock(Document.class);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.firstOrNull()).thenReturn(countersDoc);
        when(countersDoc.get(ADR_COUNTER, Integer.class)).thenReturn(14); // Current value

        // Act
        int result = counterStore.getNextAdrSequenceValue();

        // Assert
        assertThat(result, is(15));
        verify(countersDoc).put(ADR_COUNTER, 15); // Verify the counter was incremented
        verify(mockCollection).update(countersDoc); // Verify the document was updated
    }

    @Test
    public void testGetNextFlowSequenceValue() {
        // Arrange
        Document countersDoc = mock(Document.class);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.firstOrNull()).thenReturn(countersDoc);
        when(countersDoc.get(FLOW_COUNTER, Integer.class)).thenReturn(7); // Current value

        // Act
        int result = counterStore.getNextFlowSequenceValue();

        // Assert
        assertThat(result, is(8));
        verify(countersDoc).put(FLOW_COUNTER, 8); // Verify the counter was incremented
        verify(mockCollection).update(countersDoc); // Verify the document was updated
    }

    @Test
    public void testGetNextTimelineSequenceValue() {
        // Arrange
        Document countersDoc = mock(Document.class);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.firstOrNull()).thenReturn(countersDoc);
        when(countersDoc.get(TIMELINE_COUNTER, Integer.class)).thenReturn(7); // Current value

        // Act
        int result = counterStore.getNextTimelineSequenceValue();

        // Assert
        assertThat(result, is(8));
        verify(countersDoc).put(TIMELINE_COUNTER, 8); // Verify the counter was incremented
        verify(mockCollection).update(countersDoc); // Verify the document was updated
    }

    @Test
    public void testGetNextDecoratorSequenceValue() {
        // Arrange
        Document countersDoc = mock(Document.class);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.firstOrNull()).thenReturn(countersDoc);
        when(countersDoc.get(DECORATOR_COUNTER, Integer.class)).thenReturn(3);

        // Act
        int result = counterStore.getNextDecoratorSequenceValue();

        // Assert
        assertThat(result, is(4));
        verify(countersDoc).put(DECORATOR_COUNTER, 4);
        verify(mockCollection).update(countersDoc);
    }

    @Test
    public void testGetNextInterfaceSequenceValue() {
        // Arrange
        Document countersDoc = mock(Document.class);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.firstOrNull()).thenReturn(countersDoc);
        when(countersDoc.get(INTERFACE_COUNTER, Integer.class)).thenReturn(7);

        // Act
        int result = counterStore.getNextInterfaceSequenceValue();

        // Assert
        assertThat(result, is(8));
        verify(countersDoc).put(INTERFACE_COUNTER, 8);
        verify(mockCollection).update(countersDoc);
    }

    @Test
    public void testGetNextDocumentSequenceValue() {
        Document countersDoc = mock(Document.class);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.firstOrNull()).thenReturn(countersDoc);
        when(countersDoc.get(DOCUMENT_COUNTER, Integer.class)).thenReturn(5);

        assertThat(counterStore.getNextDocumentSequenceValue(), is(6));
        verify(countersDoc).put(DOCUMENT_COUNTER, 6);
        verify(mockCollection).update(countersDoc);
    }

    @Test
    public void testInitializeDocumentCounter() {
        DocumentCursor initializationCursor = mock(DocumentCursor.class);
        Document initializedCounters = mock(Document.class);
        when(mockCollection.find(any(Filter.class)))
                .thenReturn(mockCursor, initializationCursor, mockCursor);
        when(mockCursor.firstOrNull()).thenReturn(null, initializedCounters);
        when(initializationCursor.firstOrNull()).thenReturn(null);
        when(initializedCounters.get(DOCUMENT_COUNTER, Integer.class)).thenReturn(0);

        assertThat(counterStore.getNextDocumentSequenceValue(), is(1));
        ArgumentCaptor<Document> counters = ArgumentCaptor.forClass(Document.class);
        verify(mockCollection).insert(counters.capture());
        assertThat(counters.getValue().get(DOCUMENT_COUNTER, Integer.class), is(0));
        verify(initializedCounters).put(DOCUMENT_COUNTER, 1);
        verify(mockCollection).update(initializedCounters);
    }

    @Test
    public void testInitializeCountersDocument_whenDocumentDoesNotExist() {
        // Arrange
        Document newCountersDoc = mock(Document.class);
        DocumentCursor mockCursor2 = mock(DocumentCursor.class);
        DocumentCursor mockCursor3 = mock(DocumentCursor.class);

        when(mockCollection.find(any(Filter.class)))
                .thenReturn(mockCursor) // First call in nextValueForCounter
                .thenReturn(mockCursor2) // Second call in initializeCountersDocument
                .thenReturn(mockCursor3); // Third call in nextValueForCounter after initialization

        when(mockCursor.firstOrNull()).thenReturn(null); // First call returns null
        when(mockCursor2.firstOrNull()).thenReturn(null); // Second call in init also returns null
        when(mockCursor3.firstOrNull())
                .thenReturn(newCountersDoc); // Third call returns the new document

        when(newCountersDoc.get(PATTERN_COUNTER, Integer.class))
                .thenReturn(null); // New document has no counter yet

        // Act
        int result = counterStore.getNextPatternSequenceValue();

        // Assert
        assertThat(result, is(1)); // Should return 1 for first counter
        verify(mockCollection)
                .insert(any(Document.class)); // Verify initialization document was inserted
        verify(newCountersDoc).put(PATTERN_COUNTER, 1); // Verify the counter was set to 1
        verify(mockCollection).update(newCountersDoc); // Verify the document was updated
    }
}
