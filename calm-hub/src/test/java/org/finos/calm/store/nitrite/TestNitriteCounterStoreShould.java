package org.finos.calm.store.nitrite;

import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.collection.NitriteId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class TestNitriteCounterStoreShould {

    private static final String PATTERN_COUNTER = "pattern_counter";
    private static final String ARCHITECTURE_COUNTER = "architecture_counter";
    private static final String ADR_COUNTER = "adr_counter";
    private static final String FLOW_COUNTER = "flow_counter";
    private static final String COUNTERS_DOC_ID = "1";

    @Mock
    private Nitrite mockDb;

    @Mock
    private NitriteCollection mockCollection;

    private NitriteCounterStore counterStore;

    @BeforeEach
    public void setup() {
        when(mockDb.getCollection(anyString())).thenReturn(mockCollection);

        // Mock the initialization behavior
        Document initialCountersDoc = mock(Document.class);
        when(mockCollection.getById(any(NitriteId.class))).thenReturn(initialCountersDoc);

        counterStore = new NitriteCounterStore(mockDb);
    }

    @Test
    public void testGetNextPatternSequenceValue() {
        // Arrange
        Document countersDoc = mock(Document.class);
        when(mockCollection.getById(NitriteId.createId(COUNTERS_DOC_ID))).thenReturn(countersDoc);
        when(countersDoc.get(PATTERN_COUNTER, Integer.class)).thenReturn(41); // Current value

        // Act
        int result = counterStore.getNextPatternSequenceValue();

        // Assert
        assertThat(result, is(42));
        verify(countersDoc).put(PATTERN_COUNTER, 42); // Verify the counter was incremented
        verify(mockCollection).update(countersDoc); // Verify the document was updated
    }

    @Test
    public void testGetNextArchitectureSequenceValue() {
        // Arrange
        Document countersDoc = mock(Document.class);
        when(mockCollection.getById(NitriteId.createId(COUNTERS_DOC_ID))).thenReturn(countersDoc);
        when(countersDoc.get(ARCHITECTURE_COUNTER, Integer.class)).thenReturn(9); // Current value

        // Act
        int result = counterStore.getNextArchitectureSequenceValue();

        // Assert
        assertThat(result, is(10));
        verify(countersDoc).put(ARCHITECTURE_COUNTER, 10); // Verify the counter was incremented
        verify(mockCollection).update(countersDoc); // Verify the document was updated
    }

    @Test
    public void testGetNextAdrSequenceValue() {
        // Arrange
        Document countersDoc = mock(Document.class);
        when(mockCollection.getById(NitriteId.createId(COUNTERS_DOC_ID))).thenReturn(countersDoc);
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
        when(mockCollection.getById(NitriteId.createId(COUNTERS_DOC_ID))).thenReturn(countersDoc);
        when(countersDoc.get(FLOW_COUNTER, Integer.class)).thenReturn(24); // Current value

        // Act
        int result = counterStore.getNextFlowSequenceValue();

        // Assert
        assertThat(result, is(25));
        verify(countersDoc).put(FLOW_COUNTER, 25); // Verify the counter was incremented
        verify(mockCollection).update(countersDoc); // Verify the document was updated
    }

    @Test
    public void testInitializeCountersDocument_whenDocumentDoesNotExist() {
        // Create a new NitriteCounterStore with special mocking for this test
        // First, reset the mocks
        reset(mockCollection);

        // Setup the mock to return null for the first call to getById (in initializeCountersDocument)
        // and then return a mock document for subsequent calls
        Document newCountersDoc = mock(Document.class);
        when(mockCollection.getById(any(NitriteId.class)))
            .thenReturn(null)  // First call in initializeCountersDocument returns null
            .thenReturn(newCountersDoc);  // Subsequent calls return the mock document

        when(newCountersDoc.get(PATTERN_COUNTER, Integer.class)).thenReturn(0);

        // Create a new instance to trigger the initialization
        NitriteCounterStore newCounterStore = new NitriteCounterStore(mockDb);

        // Verify that insert was called during initialization
        verify(mockCollection).insert(any(Document.class));

        // Act - get the next pattern sequence value
        int result = newCounterStore.getNextPatternSequenceValue();

        // Assert
        assertThat(result, is(1));
        verify(newCountersDoc).put(PATTERN_COUNTER, 1); // Verify the counter was incremented
        verify(mockCollection).update(newCountersDoc); // Verify the document was updated
    }
}
