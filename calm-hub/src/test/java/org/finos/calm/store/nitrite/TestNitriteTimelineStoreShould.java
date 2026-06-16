package org.finos.calm.store.nitrite;

import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.DocumentCursor;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.filters.Filter;
import org.bson.json.JsonParseException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.TimelineNotFoundException;
import org.finos.calm.domain.exception.TimelineVersionExistsException;
import org.finos.calm.domain.exception.TimelineVersionNotFoundException;
import org.finos.calm.domain.timeline.CreateTimelineRequest;
import org.finos.calm.domain.timeline.NamespaceTimelineSummary;
import org.finos.calm.domain.timeline.Timeline;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class TestNitriteTimelineStoreShould {

    @Mock
    private Nitrite mockDb;

    @Mock
    private NitriteCollection mockCollection;

    @Mock
    private NitriteNamespaceStore mockNamespaceStore;

    @Mock
    private NitriteCounterStore mockCounterStore;

    private NitriteTimelineStore timelineStore;

    private static final String NAMESPACE = "finos";
    private static final int TIMELINE_ID = 42;
    private static final String VERSION = "1.0.0";
    private static final String VALID_JSON = "{\"test\": \"test\"}";

    @BeforeEach
    public void setup() {
        when(mockDb.getCollection(anyString())).thenReturn(mockCollection);
        timelineStore = new NitriteTimelineStore(mockDb, mockNamespaceStore, mockCounterStore);
    }

    @Test
    public void testGetTimelinesForNamespace_whenNamespaceDoesNotExist_throwsException() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> timelineStore.getTimelinesForNamespace(NAMESPACE));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
    }

    @Test
    public void testGetTimelinesForNamespace_whenNamespaceExistsButNoTimelines_returnsEmptyList() throws NamespaceNotFoundException {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(null);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        List<NamespaceTimelineSummary> result = timelineStore.getTimelinesForNamespace(NAMESPACE);

        assertThat(result, is(empty()));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
    }

    @Test
    public void testGetTimelinesForNamespace_whenNamespaceDocumentExists_butNoTimelinesField_returnsEmptyList() throws NamespaceNotFoundException {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document namespaceDoc = Document.createDocument()
                .put("namespace", NAMESPACE);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        List<NamespaceTimelineSummary> result = timelineStore.getTimelinesForNamespace(NAMESPACE);

        assertThat(result, is(empty()));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
    }

    @Test
    public void testGetTimelinesForNamespace_whenTimelinesExist_returnsTimelineSummaries() throws NamespaceNotFoundException {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document timeline1 = Document.createDocument().put("timelineId", 1001).put("name", "Timeline One").put("description", "First");
        Document timeline2 = Document.createDocument().put("timelineId", 1002).put("name", "Timeline Two").put("description", "Second");
        List<Document> timelines = Arrays.asList(timeline1, timeline2);

        Document namespaceDoc = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("timelines", timelines);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        List<NamespaceTimelineSummary> result = timelineStore.getTimelinesForNamespace(NAMESPACE);

        assertThat(result, hasSize(2));
        assertThat(result.get(0).getId(), is(1001));
        assertThat(result.get(0).getName(), is("Timeline One"));
        assertThat(result.get(0).getDescription(), is("First"));
        assertThat(result.get(1).getId(), is(1002));
        assertThat(result.get(1).getName(), is("Timeline Two"));
        assertThat(result.get(1).getDescription(), is("Second"));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
    }

    @Test
    public void testGetTimelinesForNamespace_whenLegacyDocumentsMissingNameAndDescription_returnsFallbacks() throws NamespaceNotFoundException {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document legacyDoc = Document.createDocument().put("timelineId", 77);
        List<Document> timelines = List.of(legacyDoc);

        Document namespaceDoc = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("timelines", timelines);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        List<NamespaceTimelineSummary> result = timelineStore.getTimelinesForNamespace(NAMESPACE);

        assertThat(result, hasSize(1));
        assertThat(result.get(0).getId(), is(77));
        assertThat(result.get(0).getName(), is("Timeline 77"));
        assertThat(result.get(0).getDescription(), is(""));
    }

    @Test
    public void testCreateTimelineForNamespace_whenNamespaceDoesNotExist_throwsException() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        CreateTimelineRequest request = new CreateTimelineRequest("name", "desc", VALID_JSON);

        assertThrows(NamespaceNotFoundException.class, () -> timelineStore.createTimelineForNamespace(request, NAMESPACE));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
    }

    @Test
    public void testCreateTimelineForNamespace_whenInvalidJson_throwsException() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        CreateTimelineRequest request = new CreateTimelineRequest("name", "desc", "Invalid JSON");

        assertThrows(Exception.class, () -> timelineStore.createTimelineForNamespace(request, NAMESPACE));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
    }

    @Test
    public void testCreateTimelineForNamespace_whenNamespaceDocumentDoesNotExist_createsNewDocument() throws NamespaceNotFoundException {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);
        when(mockCounterStore.getNextTimelineSequenceValue()).thenReturn(TIMELINE_ID);

        CreateTimelineRequest request = new CreateTimelineRequest("Test Timeline", "A test", VALID_JSON);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(null);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        Timeline result = timelineStore.createTimelineForNamespace(request, NAMESPACE);

        assertThat(result.getId(), is(TIMELINE_ID));
        assertThat(result.getNamespace(), is(NAMESPACE));
        assertThat(result.getDotVersion(), is("1.0.0"));
        assertThat(result.getTimelineJson(), is(VALID_JSON));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
        verify(mockCounterStore).getNextTimelineSequenceValue();
        verify(mockCollection).insert(any(Document.class));
    }

    @Test
    public void testCreateTimelineForNamespace_whenNamespaceDocumentExists_updatesExistingDocument() throws NamespaceNotFoundException {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);
        when(mockCounterStore.getNextTimelineSequenceValue()).thenReturn(TIMELINE_ID);

        CreateTimelineRequest request = new CreateTimelineRequest("Test Timeline", "A test", VALID_JSON);

        Document existingTimeline = Document.createDocument().put("timelineId", 1001);
        List<Document> timelines = new ArrayList<>();
        timelines.add(existingTimeline);

        Document namespaceDoc = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("timelines", timelines);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        Timeline result = timelineStore.createTimelineForNamespace(request, NAMESPACE);

        assertThat(result.getId(), is(TIMELINE_ID));
        assertThat(result.getNamespace(), is(NAMESPACE));
        assertThat(result.getDotVersion(), is("1.0.0"));
        assertThat(result.getTimelineJson(), is(VALID_JSON));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
        verify(mockCounterStore).getNextTimelineSequenceValue();
        verify(mockCollection).update(any(Filter.class), any(Document.class));
    }

    @Test
    public void testGetTimelineVersions_whenNamespaceDoesNotExist_throwsException() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        Timeline timeline = new Timeline.TimelineBuilder()
                .setNamespace(NAMESPACE)
                .setId(TIMELINE_ID)
                .build();

        assertThrows(NamespaceNotFoundException.class, () -> timelineStore.getTimelineVersions(timeline));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
    }

    @Test
    public void testGetTimelineVersions_whenTimelineDoesNotExist_throwsException() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document namespaceDoc = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("timelines", new ArrayList<>());

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        Timeline timeline = new Timeline.TimelineBuilder()
                .setNamespace(NAMESPACE)
                .setId(TIMELINE_ID)
                .build();

        assertThrows(TimelineNotFoundException.class, () -> timelineStore.getTimelineVersions(timeline));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
    }

    @Test
    public void testGetTimelineVersions_whenTimelineExists_returnsVersions() throws NamespaceNotFoundException, TimelineNotFoundException {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document namespaceDoc = mock(Document.class);
        List<Document> timelines = new ArrayList<>();
        Document timelineDoc = mock(Document.class);
        Document versions = mock(Document.class);

        timelines.add(timelineDoc);

        when(timelineDoc.get("timelineId", Integer.class)).thenReturn(TIMELINE_ID);
        when(timelineDoc.get("versions", Document.class)).thenReturn(versions);
        when(namespaceDoc.get("timelines", List.class)).thenReturn(timelines);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        when(versions.getFields()).thenReturn(java.util.Collections.emptySet());

        Timeline timeline = new Timeline.TimelineBuilder()
                .setNamespace(NAMESPACE)
                .setId(TIMELINE_ID)
                .build();

        List<String> result = timelineStore.getTimelineVersions(timeline);

        assertThat(result, is(notNullValue()));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
        verify(versions).getFields();
    }

    @Test
    public void testGetTimelineForVersion_whenNamespaceDoesNotExist_throwsException() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        Timeline timeline = new Timeline.TimelineBuilder()
                .setNamespace(NAMESPACE)
                .setId(TIMELINE_ID)
                .setVersion(VERSION)
                .build();

        assertThrows(NamespaceNotFoundException.class, () -> timelineStore.getTimelineForVersion(timeline));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
    }

    @Test
    public void testGetTimelineForVersion_whenTimelineDoesNotExist_throwsException() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document namespaceDoc = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("timelines", new ArrayList<>());

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        Timeline timeline = new Timeline.TimelineBuilder()
                .setNamespace(NAMESPACE)
                .setId(TIMELINE_ID)
                .setVersion(VERSION)
                .build();

        assertThrows(TimelineVersionNotFoundException.class, () -> timelineStore.getTimelineForVersion(timeline));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
    }

    @Test
    public void testGetTimelineForVersion_whenVersionDoesNotExist_throwsException() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document versions = Document.createDocument()
                .put("2-0-0", VALID_JSON);

        Document timelineDoc = Document.createDocument()
                .put("timelineId", TIMELINE_ID)
                .put("versions", versions);

        List<Document> timelines = new ArrayList<>();
        timelines.add(timelineDoc);

        Document namespaceDoc = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("timelines", timelines);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        Timeline timeline = new Timeline.TimelineBuilder()
                .setNamespace(NAMESPACE)
                .setId(TIMELINE_ID)
                .setVersion(VERSION)
                .build();

        assertThrows(TimelineVersionNotFoundException.class, () -> timelineStore.getTimelineForVersion(timeline));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
    }

    @Test
    public void testGetTimelineVersions_whenVersionsDocumentIsNull_throwsTimelineNotFoundException() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document timelineDoc = Document.createDocument().put("timelineId", TIMELINE_ID);
        Document namespaceDoc = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("timelines", List.of(timelineDoc));

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        Timeline timeline = new Timeline.TimelineBuilder().setNamespace(NAMESPACE).setId(TIMELINE_ID).build();

        assertThrows(TimelineNotFoundException.class, () -> timelineStore.getTimelineVersions(timeline));
    }

    @Test
    public void testGetTimelineForVersion_whenVersionsDocumentIsNull_throwsTimelineVersionNotFoundException() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document timelineDoc = Document.createDocument().put("timelineId", TIMELINE_ID);
        Document namespaceDoc = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("timelines", List.of(timelineDoc));

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        Timeline timeline = new Timeline.TimelineBuilder().setNamespace(NAMESPACE).setId(TIMELINE_ID).setVersion(VERSION).build();

        assertThrows(TimelineVersionNotFoundException.class, () -> timelineStore.getTimelineForVersion(timeline));
    }

    @Test
    public void testGetTimelineForVersion_whenVersionObjIsNotAString_throwsTimelineVersionNotFoundException() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document versions = Document.createDocument().put("1-0-0", 12345);
        Document timelineDoc = Document.createDocument()
                .put("timelineId", TIMELINE_ID)
                .put("versions", versions);
        Document namespaceDoc = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("timelines", List.of(timelineDoc));

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        Timeline timeline = new Timeline.TimelineBuilder().setNamespace(NAMESPACE).setId(TIMELINE_ID).setVersion(VERSION).build();

        assertThrows(TimelineVersionNotFoundException.class, () -> timelineStore.getTimelineForVersion(timeline));
    }

    @Test
    public void testGetTimelineForVersion_whenVersionExists_returnsTimelineJson() throws NamespaceNotFoundException, TimelineNotFoundException, TimelineVersionNotFoundException {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document versions = Document.createDocument()
                .put("1-0-0", VALID_JSON);

        Document timelineDoc = Document.createDocument()
                .put("timelineId", TIMELINE_ID)
                .put("versions", versions);

        List<Document> timelines = new ArrayList<>();
        timelines.add(timelineDoc);

        Document namespaceDoc = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("timelines", timelines);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        Timeline timeline = new Timeline.TimelineBuilder()
                .setNamespace(NAMESPACE)
                .setId(TIMELINE_ID)
                .setVersion(VERSION)
                .build();

        String result = timelineStore.getTimelineForVersion(timeline);

        assertThat(result, is(VALID_JSON));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
    }

    @Test
    public void testCreateTimelineForVersion_whenNamespaceDoesNotExist_throwsException() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        Timeline timeline = new Timeline.TimelineBuilder()
                .setNamespace(NAMESPACE)
                .setId(TIMELINE_ID)
                .setVersion(VERSION)
                .setTimeline(VALID_JSON)
                .build();

        assertThrows(NamespaceNotFoundException.class, () -> timelineStore.createTimelineForVersion(timeline));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
    }

    @Test
    public void testCreateTimelineForVersion_whenVersionExists_throwsException() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document versions = Document.createDocument()
                .put("1-0-0", VALID_JSON);

        Document timelineDoc = Document.createDocument()
                .put("timelineId", TIMELINE_ID)
                .put("versions", versions);

        List<Document> timelines = new ArrayList<>();
        timelines.add(timelineDoc);

        Document namespaceDoc = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("timelines", timelines);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        Timeline timeline = new Timeline.TimelineBuilder()
                .setNamespace(NAMESPACE)
                .setId(TIMELINE_ID)
                .setVersion(VERSION)
                .setTimeline(VALID_JSON)
                .build();

        assertThrows(TimelineVersionExistsException.class, () -> timelineStore.createTimelineForVersion(timeline));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
    }

    @Test
    public void testCreateTimelineForVersion_whenVersionDoesNotExist_createsVersion() throws NamespaceNotFoundException, TimelineNotFoundException, TimelineVersionExistsException {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document versions = Document.createDocument()
                .put("2-0-0", VALID_JSON); // Different version

        Document timelineDoc = Document.createDocument()
                .put("timelineId", TIMELINE_ID)
                .put("versions", versions);

        List<Document> timelines = new ArrayList<>();
        timelines.add(timelineDoc);

        Document namespaceDoc = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("timelines", timelines);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        Timeline timeline = new Timeline.TimelineBuilder()
                .setNamespace(NAMESPACE)
                .setId(TIMELINE_ID)
                .setVersion(VERSION) // 1.0.0
                .setTimeline(VALID_JSON)
                .build();

        Timeline result = timelineStore.createTimelineForVersion(timeline);

        assertThat(result, is(timeline));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
        verify(mockCollection).update(any(Filter.class), any(Document.class));
    }

    @Test
    public void testCreateTimelineForVersion_whenInvalidJson_throwsJsonParseException() {
        // JSON is validated immediately after the namespace check, before any version/existence lookup
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Timeline timeline = new Timeline.TimelineBuilder()
                .setNamespace(NAMESPACE)
                .setId(TIMELINE_ID)
                .setVersion(VERSION)
                .setTimeline("{ not json")
                .build();

        assertThrows(JsonParseException.class, () -> timelineStore.createTimelineForVersion(timeline));
        verify(mockCollection, never()).update(any(Filter.class), any(Document.class));
    }

    @Test
    public void testUpdateTimelineForVersion_whenInvalidJson_throwsJsonParseException() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Timeline timeline = new Timeline.TimelineBuilder()
                .setNamespace(NAMESPACE)
                .setId(TIMELINE_ID)
                .setVersion(VERSION)
                .setTimeline("{ not json")
                .build();

        assertThrows(JsonParseException.class, () -> timelineStore.updateTimelineForVersion(timeline));
        verify(mockCollection, never()).update(any(Filter.class), any(Document.class));
    }

    @Test
    public void testUpdateTimelineForVersion_whenNullJson_throwsJsonParseException() {
        // null JSON is rejected by the explicit null guard before any parse/lookup
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Timeline timeline = new Timeline.TimelineBuilder()
                .setNamespace(NAMESPACE)
                .setId(TIMELINE_ID)
                .setVersion(VERSION)
                .setTimeline(null)
                .build();

        assertThrows(JsonParseException.class, () -> timelineStore.updateTimelineForVersion(timeline));
        verify(mockCollection, never()).update(any(Filter.class), any(Document.class));
    }

    @Test
    public void testUpdateTimelineForVersion_whenNamespaceDoesNotExist_throwsException() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        Timeline timeline = new Timeline.TimelineBuilder()
                .setNamespace(NAMESPACE)
                .setId(TIMELINE_ID)
                .setVersion(VERSION)
                .setTimeline(VALID_JSON)
                .build();

        assertThrows(NamespaceNotFoundException.class, () -> timelineStore.updateTimelineForVersion(timeline));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
    }

    @Test
    public void testUpdateTimelineForVersion_whenTimelineDoesNotExist_throwsException() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document namespaceDoc = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("timelines", new ArrayList<>());

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        Timeline timeline = new Timeline.TimelineBuilder()
                .setNamespace(NAMESPACE)
                .setId(TIMELINE_ID)
                .setVersion(VERSION)
                .setTimeline(VALID_JSON)
                .build();

        assertThrows(TimelineNotFoundException.class, () -> timelineStore.updateTimelineForVersion(timeline));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
    }

    @Test
    public void testUpdateTimelineForVersion_whenVersionsDocumentIsNull_throwsTimelineNotFoundException() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document timelineDoc = Document.createDocument().put("timelineId", TIMELINE_ID);
        Document namespaceDoc = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("timelines", List.of(timelineDoc));

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        Timeline timeline = new Timeline.TimelineBuilder()
                .setNamespace(NAMESPACE)
                .setId(TIMELINE_ID)
                .setVersion(VERSION)
                .setTimeline(VALID_JSON)
                .build();

        assertThrows(TimelineNotFoundException.class, () -> timelineStore.updateTimelineForVersion(timeline));
    }

    @Test
    public void testUpdateTimelineForVersion_whenValidParameters_returnsUpdatedTimeline() throws NamespaceNotFoundException, TimelineNotFoundException {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document versions = Document.createDocument()
                .put("1-0-0", VALID_JSON);

        Document timelineDoc = Document.createDocument()
                .put("timelineId", TIMELINE_ID)
                .put("versions", versions);

        List<Document> timelines = new ArrayList<>();
        timelines.add(timelineDoc);

        Document namespaceDoc = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("timelines", timelines);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        Timeline timeline = new Timeline.TimelineBuilder()
                .setNamespace(NAMESPACE)
                .setId(TIMELINE_ID)
                .setVersion(VERSION)
                .setTimeline(VALID_JSON)
                .build();

        Timeline result = timelineStore.updateTimelineForVersion(timeline);

        assertThat(result, is(timeline));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
        verify(mockCollection).update(any(Filter.class), any(Document.class));
    }
}
