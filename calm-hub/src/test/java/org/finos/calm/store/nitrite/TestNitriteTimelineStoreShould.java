package org.finos.calm.store.nitrite;

import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.DocumentCursor;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.exceptions.NitriteException;
import org.dizitart.no2.filters.Filter;
import org.bson.json.JsonParseException;
import org.finos.calm.domain.timeline.Timeline;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.TimelineNotFoundException;
import org.finos.calm.domain.exception.TimelineVersionExistsException;
import org.finos.calm.domain.exception.TimelineVersionNotFoundException;
import org.finos.calm.domain.exception.StorageWriteException;
import org.finos.calm.domain.timeline.CreateTimelineRequest;
import org.finos.calm.domain.timeline.NamespaceTimelineSummary;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doCallRealMethod;

/**
 * Store-level tests for the header/version shape. Document mechanics are covered by
 * {@code TestNitriteVersionDocumentStoreShould}; what this class pins is the glue — the
 * domain exceptions, the JSON validation this backend does and Mongo doesn't, and Timeline's
 * blank-guarding of name/description.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
public class TestNitriteTimelineStoreShould {

    @Mock
    private Nitrite mockDb;

    @Mock
    private NitriteNamespaceStore mockNamespaceStore;

    @Mock
    private NitriteCounterStore mockCounterStore;

    private NitriteCollection headerCollection;
    private NitriteCollection versionCollection;
    private NitriteTimelineStore store;

    private static final String NAMESPACE = "finos";
    private static final int TIMELINE_ID = 42;
    private static final String VALID_JSON = "{\"test\": \"test\"}";
    private static final String TIMELINE_NAME = "timeline-name";
    private static final String TIMELINE_DESCRIPTION = "timeline description";

    @BeforeEach
    public void setup() throws NamespaceNotFoundException {
        doCallRealMethod().when(mockNamespaceStore).requireNamespace(anyString());
        headerCollection = mock(NitriteCollection.class);
        versionCollection = mock(NitriteCollection.class);

        when(mockDb.getCollection("timelines")).thenReturn(headerCollection);
        when(mockDb.getCollection("timelineVersions")).thenReturn(versionCollection);
        when(mockNamespaceStore.namespaceExists(anyString())).thenReturn(true);

        store = new NitriteTimelineStore(mockDb, mockNamespaceStore, mockCounterStore);
    }

    private void stubFind(NitriteCollection collection, List<Document> documents) {
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(collection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(documents.isEmpty() ? null : documents.get(0));
        when(cursor.iterator()).thenAnswer(invocation -> documents.iterator());
        when(collection.find()).thenReturn(cursor);
    }

    private void timelineExists() {
        stubFind(headerCollection, List.of(Document.createDocument()
                .put("timelineId", TIMELINE_ID)
                .put("versionCount", 1)));
    }

    private void timelineDoesNotExist() {
        stubFind(headerCollection, List.of());
    }

    private static Timeline timeline(String version, String name, String description) {
        return new Timeline.TimelineBuilder()
                .setNamespace(NAMESPACE)
                .setId(TIMELINE_ID)
                .setVersion(version)
                .setName(name)
                .setDescription(description)
                .setTimeline(VALID_JSON)
                .build();
    }

    private static Timeline timeline(String version) {
        return timeline(version, TIMELINE_NAME, TIMELINE_DESCRIPTION);
    }

    private static CreateTimelineRequest createRequest() {
        return new CreateTimelineRequest(TIMELINE_NAME, TIMELINE_DESCRIPTION, VALID_JSON);
    }

    // --- getTimelinesForNamespace ---

    @Test
    public void throw_a_namespace_exception_when_listing_timelines_for_a_missing_namespace() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> store.getTimelinesForNamespace(NAMESPACE));
    }

    @Test
    public void return_an_empty_list_when_a_namespace_has_no_timelines() throws NamespaceNotFoundException {
        stubFind(headerCollection, List.of());

        assertThat(store.getTimelinesForNamespace(NAMESPACE), is(empty()));
    }

    @Test
    public void return_a_summary_per_header_document_without_a_version_count() throws NamespaceNotFoundException {
        stubFind(headerCollection, List.of(
                Document.createDocument().put("timelineId", 1).put("name", "First")
                        .put("description", "d1").put("versionCount", 2),
                Document.createDocument().put("timelineId", 2).put("name", "Second")
                        .put("description", "d2").put("versionCount", 0)));

        assertThat(store.getTimelinesForNamespace(NAMESPACE), contains(
                new NamespaceTimelineSummary("First", "d1", 1),
                new NamespaceTimelineSummary("Second", "d2", 2)));
    }

    @Test
    public void fall_back_to_a_generated_name_for_headers_missing_one() throws NamespaceNotFoundException {
        stubFind(headerCollection, List.of(Document.createDocument().put("timelineId", 7)));

        assertThat(store.getTimelinesForNamespace(NAMESPACE), contains(
                new NamespaceTimelineSummary("Timeline 7", "", 7)));
    }


    // --- createTimelineForNamespace ---

    @Test
    public void throw_a_namespace_exception_when_creating_a_timeline_in_a_missing_namespace() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.createTimelineForNamespace(createRequest(), NAMESPACE));
    }

    @Test
    public void reject_invalid_json_when_creating_a_timeline() {
        CreateTimelineRequest invalid = new CreateTimelineRequest("n", "d", "{invalid json}");

        assertThrows(JsonParseException.class, () -> store.createTimelineForNamespace(invalid, NAMESPACE));
        verify(headerCollection, never()).insert(any(Document.class));
    }

    @Test
    public void reject_null_json_when_creating_a_timeline() {
        CreateTimelineRequest noJson = new CreateTimelineRequest("n", "d", null);

        // This backend validates up front; Mongo would NPE inside Document.parse instead.
        assertThrows(JsonParseException.class, () -> store.createTimelineForNamespace(noJson, NAMESPACE));
    }

    @Test
    public void create_a_header_and_an_initial_version() throws NamespaceNotFoundException {
        when(mockCounterStore.getNextTimelineSequenceValue()).thenReturn(99);
        stubFind(headerCollection, List.of(Document.createDocument()
                .put("timelineId", 99).put("versionCount", 0)));
        stubFind(versionCollection, List.of());

        Timeline created = store.createTimelineForNamespace(createRequest(), NAMESPACE);

        assertThat(created.getId(), is(99));
        // Was "1-0-0" before this port, so the Location header differed by backend for the
        // same operation. Now dot-separated on both, matching what is actually stored.
        assertThat(created.getDotVersion(), is("1.0.0"));

        ArgumentCaptor<Document> headerCaptor = ArgumentCaptor.forClass(Document.class);
        verify(headerCollection).insert(headerCaptor.capture());
        assertThat(headerCaptor.getValue().get("timelineId", Integer.class), is(99));
        assertThat(headerCaptor.getValue().get("versionCount", Integer.class), is(0));

        ArgumentCaptor<Document> versionCaptor = ArgumentCaptor.forClass(Document.class);
        verify(versionCollection).insert(versionCaptor.capture());
        assertThat(versionCaptor.getValue().get("version", String.class), is("1.0.0"));
        // Content stays a JSON string in this backend rather than a parsed document.
        assertThat(versionCaptor.getValue().get("content", String.class), is(VALID_JSON));
    }

    @Test
    public void remove_the_header_again_when_the_first_version_write_fails() {
        when(mockCounterStore.getNextTimelineSequenceValue()).thenReturn(99);
        stubFind(headerCollection, List.of());
        stubFind(versionCollection, List.of());
        when(versionCollection.insert(any(Document.class)))
                .thenThrow(new NitriteException("store is closed"));

        assertThrows(NitriteException.class,
                () -> store.createTimelineForNamespace(createRequest(), NAMESPACE));

        verify(headerCollection).remove(any(Filter.class));
    }

    @Test
    public void fail_rather_than_report_success_when_the_initial_version_already_exists() {
        when(mockCounterStore.getNextTimelineSequenceValue()).thenReturn(99);
        stubFind(headerCollection, List.of());
        stubFind(versionCollection, List.of(Document.createDocument().put("version", "1.0.0")));

        assertThrows(StorageWriteException.class,
                () -> store.createTimelineForNamespace(createRequest(), NAMESPACE));

        verify(headerCollection).remove(any(Filter.class));
    }

    // --- getTimelineVersions ---

    @Test
    public void throw_a_timeline_exception_when_listing_versions_for_a_missing_timeline() {
        timelineDoesNotExist();

        assertThrows(TimelineNotFoundException.class, () -> store.getTimelineVersions(timeline(null)));
    }

    @Test
    public void list_versions_in_semantic_order() throws NamespaceNotFoundException, TimelineNotFoundException {
        timelineExists();
        stubFind(versionCollection, List.of(
                Document.createDocument().put("version", "1.10.0"),
                Document.createDocument().put("version", "1.9.0"),
                Document.createDocument().put("version", "1.0.0")));

        assertThat(store.getTimelineVersions(timeline(null)), contains("1.0.0", "1.9.0", "1.10.0"));
    }

    @Test
    public void return_no_versions_rather_than_not_found_for_a_timeline_with_none() throws NamespaceNotFoundException, TimelineNotFoundException {
        timelineExists();
        stubFind(versionCollection, List.of());

        assertThat(store.getTimelineVersions(timeline(null)), is(empty()));
    }

    // --- getTimelineForVersion ---

    @Test
    public void throw_a_timeline_exception_when_getting_a_version_of_a_missing_timeline() {
        timelineDoesNotExist();

        assertThrows(TimelineNotFoundException.class, () -> store.getTimelineForVersion(timeline("1.0.0")));
    }

    @Test
    public void throw_a_version_exception_when_the_version_is_not_stored() {
        timelineExists();
        stubFind(versionCollection, List.of());

        assertThrows(TimelineVersionNotFoundException.class,
                () -> store.getTimelineForVersion(timeline("9.0.0")));
    }

    @Test
    public void return_the_content_of_a_stored_version() throws Exception {
        timelineExists();
        stubFind(versionCollection, List.of(Document.createDocument().put("content", VALID_JSON)));

        assertThat(store.getTimelineForVersion(timeline("1.0.0")), is(VALID_JSON));
    }

    // --- createTimelineForVersion ---

    @Test
    public void reject_invalid_json_before_checking_the_timeline_exists() {
        timelineDoesNotExist();
        Timeline invalid = new Timeline.TimelineBuilder()
                .setNamespace(NAMESPACE).setId(TIMELINE_ID).setVersion("1.0.1")
                .setTimeline("{invalid json}").build();

        // Deliberate divergence from Mongo, which reports the missing timeline first.
        assertThrows(JsonParseException.class, () -> store.createTimelineForVersion(invalid));
    }

    @Test
    public void throw_a_timeline_exception_when_creating_a_version_for_a_missing_timeline() {
        timelineDoesNotExist();

        assertThrows(TimelineNotFoundException.class,
                () -> store.createTimelineForVersion(timeline("1.0.1")));
    }

    @Test
    public void throw_a_version_exists_exception_when_the_version_is_already_stored() {
        timelineExists();
        stubFind(versionCollection, List.of(Document.createDocument().put("version", "1.0.1")));

        assertThrows(TimelineVersionExistsException.class,
                () -> store.createTimelineForVersion(timeline("1.0.1")));
    }

    @Test
    public void not_rename_the_timeline_when_the_version_already_exists() {
        timelineExists();
        stubFind(versionCollection, List.of(Document.createDocument().put("version", "1.0.1")));

        assertThrows(TimelineVersionExistsException.class,
                () -> store.createTimelineForVersion(timeline("1.0.1")));

        verify(headerCollection, never()).update(any(Filter.class), any(Document.class));
    }

    @Test
    public void write_the_version_and_then_the_header_details() throws Exception {
        timelineExists();
        stubFind(versionCollection, List.of());

        store.createTimelineForVersion(timeline("1.0.1"));

        ArgumentCaptor<Document> versionCaptor = ArgumentCaptor.forClass(Document.class);
        verify(versionCollection).insert(versionCaptor.capture());
        assertThat(versionCaptor.getValue().get("version", String.class), is("1.0.1"));
        // Two header writes: the versionCount increment, then the name/description update.
        verify(headerCollection, times(2)).update(any(Filter.class), any(Document.class));
    }

    @Test
    public void leave_the_stored_name_alone_when_a_version_write_carries_none() throws Exception {
        timelineExists();
        stubFind(versionCollection, List.of());

        store.createTimelineForVersion(timeline("1.0.1", null, null));

        // Timeline guards these fields where Architecture overwrites them, so only the
        // versionCount write happens here.
        verify(headerCollection, times(1)).update(any(Filter.class), any(Document.class));
    }

    // --- updateTimelineForVersion ---

    @Test
    public void throw_a_timeline_exception_when_updating_a_version_for_a_missing_timeline() {
        timelineDoesNotExist();

        assertThrows(TimelineNotFoundException.class,
                () -> store.updateTimelineForVersion(timeline("1.0.1")));
    }

    @Test
    public void replace_the_content_of_an_existing_version_on_update() throws Exception {
        timelineExists();
        stubFind(versionCollection, List.of(Document.createDocument()
                .put("version", "1.0.1").put("content", "{\"old\":true}")));

        store.updateTimelineForVersion(timeline("1.0.1"));

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(versionCollection).update(any(Filter.class), captor.capture());
        assertThat(captor.getValue().get("content", String.class), is(VALID_JSON));
    }

    @Test
    public void create_the_version_when_updating_one_that_does_not_exist() throws Exception {
        timelineExists();
        stubFind(versionCollection, List.of());

        // Preserves the known create-on-PUT behaviour (bugs.md #1) rather than changing it.
        store.updateTimelineForVersion(timeline("2.0.0"));

        verify(versionCollection).insert(any(Document.class));
    }

    // --- deleteTimeline ---

    @Test
    public void throw_a_namespace_exception_when_deleting_a_timeline_in_a_missing_namespace() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> store.deleteTimeline(NAMESPACE, TIMELINE_ID));
    }

    @Test
    public void delete_the_header_and_all_versions_when_the_timeline_exists() throws Exception {
        timelineExists();
        stubFind(versionCollection, List.of(
                Document.createDocument().put("version", "1.0.0"),
                Document.createDocument().put("version", "1.0.1")));

        store.deleteTimeline(NAMESPACE, TIMELINE_ID);

        verify(versionCollection, org.mockito.Mockito.times(2)).remove(any(Document.class));
        verify(headerCollection).remove(any(Document.class));
    }

    @Test
    public void throw_a_timeline_exception_when_deleting_a_missing_timeline() {
        timelineDoesNotExist();

        assertThrows(TimelineNotFoundException.class, () -> store.deleteTimeline(NAMESPACE, TIMELINE_ID));
    }
}
