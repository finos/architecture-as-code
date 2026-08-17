package org.finos.calm.store.mongo;

import com.mongodb.MongoWriteException;
import com.mongodb.ServerAddress;
import com.mongodb.WriteError;
import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.UpdateOptions;
import com.mongodb.client.result.UpdateResult;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.bson.BsonDocument;
import org.bson.Document;
import org.bson.conversions.Bson;
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
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

import java.util.List;
import java.util.function.Consumer;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doCallRealMethod;

/**
 * Store-level tests for the header/version shape. Document mechanics are covered by
 * {@code TestMongoVersionDocumentStoreShould}; what this class pins is the glue — which
 * domain exception each missing thing produces, and Timeline's blank-guarding of
 * name/description, which is where it deliberately differs from Architecture.
 */
@QuarkusTest
public class TestMongoTimelineStoreShould {

    @InjectMock
    MongoDatabase mongoDatabase;

    @InjectMock
    MongoCounterStore counterStore;

    @InjectMock
    MongoNamespaceStore namespaceStore;

    private interface DocumentMongoCollection extends MongoCollection<Document> {
    }

    private interface DocumentFindIterable extends FindIterable<Document> {
    }

    private MongoCollection<Document> headerCollection;
    private MongoCollection<Document> versionCollection;
    private MongoTimelineStore store;

    private static final String NAMESPACE = "finos";
    private static final int TIMELINE_ID = 42;
    private static final String VALID_JSON = "{\"test\": \"test\"}";

    @BeforeEach
    void setup() throws NamespaceNotFoundException {
        doCallRealMethod().when(namespaceStore).requireNamespace(anyString());
        headerCollection = Mockito.mock(DocumentMongoCollection.class);
        versionCollection = Mockito.mock(DocumentMongoCollection.class);

        when(mongoDatabase.getCollection("timelines")).thenReturn(headerCollection);
        when(mongoDatabase.getCollection("timelineVersions")).thenReturn(versionCollection);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);

        store = new MongoTimelineStore(mongoDatabase, counterStore, namespaceStore);
    }

    private FindIterable<Document> stubFind(MongoCollection<Document> collection, List<Document> documents) {
        FindIterable<Document> iterable = Mockito.mock(DocumentFindIterable.class);
        when(collection.find(any(Bson.class))).thenReturn(iterable);
        when(iterable.projection(any())).thenReturn(iterable);
        when(iterable.sort(any())).thenReturn(iterable);
        when(iterable.skip(anyInt())).thenReturn(iterable);
        when(iterable.limit(anyInt())).thenReturn(iterable);
        when(iterable.first()).thenReturn(documents.isEmpty() ? null : documents.get(0));
        doAnswer(invocation -> {
            Consumer<Document> consumer = invocation.getArgument(0);
            documents.forEach(consumer);
            return null;
        }).when(iterable).forEach(any());
        return iterable;
    }

    private void timelineExists() {
        stubFind(headerCollection, List.of(new Document("timelineId", TIMELINE_ID)));
        when(headerCollection.updateOne(any(Bson.class), any(Bson.class)))
                .thenReturn(UpdateResult.acknowledged(1, 1L, null));
    }

    private void timelineDoesNotExist() {
        stubFind(headerCollection, List.of());
    }

    private static MongoWriteException writeError(int code, String message) {
        return new MongoWriteException(new WriteError(code, message, new BsonDocument()), new ServerAddress(), List.of());
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
        return timeline(version, "timeline-name", "timeline-description");
    }

    private static CreateTimelineRequest createRequest() {
        return new CreateTimelineRequest("timeline-name", "timeline-description", VALID_JSON);
    }

    // --- getTimelinesForNamespace ---

    @Test
    void throw_a_namespace_exception_when_listing_timelines_for_a_missing_namespace() {
        when(namespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> store.getTimelinesForNamespace(NAMESPACE));
    }

    @Test
    void return_an_empty_list_when_a_namespace_has_no_timelines() throws NamespaceNotFoundException {
        stubFind(headerCollection, List.of());

        assertThat(store.getTimelinesForNamespace(NAMESPACE), is(empty()));
    }

    @Test
    void return_a_summary_per_header_document_without_a_version_count() throws NamespaceNotFoundException {
        stubFind(headerCollection, List.of(
                new Document("timelineId", 1).append("name", "First").append("description", "d1")
                        .append("versionCount", 2),
                new Document("timelineId", 2).append("name", "Second").append("description", "d2")
                        .append("versionCount", 0)));

        assertThat(store.getTimelinesForNamespace(NAMESPACE), contains(
                new NamespaceTimelineSummary("First", "d1", 1),
                new NamespaceTimelineSummary("Second", "d2", 2)));
    }

    @Test
    void fall_back_to_a_generated_name_for_headers_missing_one() throws NamespaceNotFoundException {
        stubFind(headerCollection, List.of(new Document("timelineId", 7)));

        assertThat(store.getTimelinesForNamespace(NAMESPACE), contains(
                new NamespaceTimelineSummary("Timeline 7", "", 7)));
    }


    // --- createTimelineForNamespace ---

    @Test
    void throw_a_namespace_exception_when_creating_a_timeline_in_a_missing_namespace() {
        when(namespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.createTimelineForNamespace(createRequest(), NAMESPACE));
    }

    @Test
    void reject_invalid_json_before_drawing_an_id_or_writing_anything() {
        CreateTimelineRequest invalid = new CreateTimelineRequest("n", "d", "{invalid json}");

        assertThrows(JsonParseException.class, () -> store.createTimelineForNamespace(invalid, NAMESPACE));

        verify(counterStore, never()).getNextTimelineSequenceValue();
        verify(headerCollection, never()).insertOne(any(Document.class));
    }

    @Test
    void create_a_header_and_an_initial_version() throws NamespaceNotFoundException {
        when(counterStore.getNextTimelineSequenceValue()).thenReturn(99);
        when(headerCollection.updateOne(any(Bson.class), any(Bson.class)))
                .thenReturn(UpdateResult.acknowledged(1, 1L, null));

        Timeline created = store.createTimelineForNamespace(createRequest(), NAMESPACE);

        assertThat(created.getId(), is(99));
        // Dot-separated on both backends now; Nitrite used to return "1-0-0" here.
        assertThat(created.getDotVersion(), is("1.0.0"));

        ArgumentCaptor<Document> headerCaptor = ArgumentCaptor.forClass(Document.class);
        verify(headerCollection).insertOne(headerCaptor.capture());
        assertThat(headerCaptor.getValue().getInteger("timelineId"), is(99));
        assertThat(headerCaptor.getValue().getInteger("versionCount"), is(0));

        ArgumentCaptor<Document> versionCaptor = ArgumentCaptor.forClass(Document.class);
        verify(versionCollection).insertOne(versionCaptor.capture());
        assertThat(versionCaptor.getValue().getString("version"), is("1.0.0"));
    }

    @Test
    void remove_the_header_again_when_the_first_version_write_fails() {
        when(counterStore.getNextTimelineSequenceValue()).thenReturn(99);
        doAnswer(invocation -> {
            throw writeError(10334, "object to insert too large");
        }).when(versionCollection).insertOne(any(Document.class));

        assertThrows(StorageWriteException.class,
                () -> store.createTimelineForNamespace(createRequest(), NAMESPACE));

        verify(headerCollection).deleteOne(any(Bson.class));
    }

    // --- getTimelineVersions ---

    @Test
    void throw_a_namespace_exception_when_listing_versions_for_a_missing_namespace() {
        when(namespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> store.getTimelineVersions(timeline(null)));
    }

    @Test
    void throw_a_timeline_exception_when_listing_versions_for_a_missing_timeline() {
        timelineDoesNotExist();

        assertThrows(TimelineNotFoundException.class, () -> store.getTimelineVersions(timeline(null)));
    }

    @Test
    void list_versions_in_semantic_order() throws NamespaceNotFoundException, TimelineNotFoundException {
        stubFind(headerCollection, List.of(new Document("timelineId", TIMELINE_ID)));
        stubFind(versionCollection, List.of(
                new Document("version", "1.10.0"),
                new Document("version", "1.9.0"),
                new Document("version", "1.0.0")));

        assertThat(store.getTimelineVersions(timeline(null)), contains("1.0.0", "1.9.0", "1.10.0"));
    }

    @Test
    void return_no_versions_rather_than_not_found_for_a_timeline_with_none() throws NamespaceNotFoundException, TimelineNotFoundException {
        stubFind(headerCollection, List.of(new Document("timelineId", TIMELINE_ID)));
        stubFind(versionCollection, List.of());

        // ADR 0003: the header proves the timeline exists, so an empty version list is an
        // answer rather than evidence of a missing timeline.
        assertThat(store.getTimelineVersions(timeline(null)), is(empty()));
    }

    // --- getTimelineForVersion ---

    @Test
    void throw_a_timeline_exception_when_getting_a_version_of_a_missing_timeline() {
        timelineDoesNotExist();

        assertThrows(TimelineNotFoundException.class, () -> store.getTimelineForVersion(timeline("1.0.0")));
    }

    @Test
    void throw_a_version_exception_when_the_version_is_not_stored() {
        stubFind(headerCollection, List.of(new Document("timelineId", TIMELINE_ID)));
        stubFind(versionCollection, List.of());

        assertThrows(TimelineVersionNotFoundException.class,
                () -> store.getTimelineForVersion(timeline("9.0.0")));
    }

    @Test
    void return_the_content_of_a_stored_version() throws Exception {
        stubFind(headerCollection, List.of(new Document("timelineId", TIMELINE_ID)));
        stubFind(versionCollection, List.of(new Document("content", new Document("test", "test"))));

        assertThat(store.getTimelineForVersion(timeline("1.0.0")), containsString("\"test\""));
    }

    // --- createTimelineForVersion ---

    @Test
    void throw_a_timeline_exception_when_creating_a_version_for_a_missing_timeline() {
        timelineDoesNotExist();

        assertThrows(TimelineNotFoundException.class,
                () -> store.createTimelineForVersion(timeline("1.0.1")));
    }

    @Test
    void throw_a_version_exists_exception_when_the_version_is_already_stored() {
        timelineExists();
        doAnswer(invocation -> {
            throw writeError(11000, "duplicate key");
        }).when(versionCollection).insertOne(any(Document.class));

        assertThrows(TimelineVersionExistsException.class,
                () -> store.createTimelineForVersion(timeline("1.0.1")));
    }

    @Test
    void not_rename_the_timeline_when_the_version_already_exists() {
        timelineExists();
        doAnswer(invocation -> {
            throw writeError(11000, "duplicate key");
        }).when(versionCollection).insertOne(any(Document.class));

        assertThrows(TimelineVersionExistsException.class,
                () -> store.createTimelineForVersion(timeline("1.0.1")));

        verify(headerCollection, never()).updateOne(any(Bson.class), any(Bson.class));
    }

    @Test
    void write_the_version_and_then_the_header_details() throws Exception {
        timelineExists();

        store.createTimelineForVersion(timeline("1.0.1"));

        ArgumentCaptor<Document> versionCaptor = ArgumentCaptor.forClass(Document.class);
        verify(versionCollection).insertOne(versionCaptor.capture());
        assertThat(versionCaptor.getValue().getString("version"), is("1.0.1"));
        // Two header writes: the versionCount increment and the name/description update.
        verify(headerCollection, Mockito.times(2)).updateOne(any(Bson.class), any(Bson.class));
    }

    @Test
    void leave_the_stored_name_alone_when_a_version_write_carries_none() throws Exception {
        timelineExists();

        store.createTimelineForVersion(timeline("1.0.1", null, null));

        // Where Architecture overwrites unconditionally — wiping the display name, bugs.md
        // #2 — Timeline's old shape guarded these fields, so only the count write happens.
        verify(headerCollection, Mockito.times(1)).updateOne(any(Bson.class), any(Bson.class));
    }

    @Test
    void update_only_the_details_that_are_present() throws Exception {
        timelineExists();

        store.createTimelineForVersion(timeline("1.0.1", "Renamed", "  "));

        ArgumentCaptor<Bson> updateCaptor = ArgumentCaptor.forClass(Bson.class);
        verify(headerCollection, Mockito.times(2)).updateOne(any(Bson.class), updateCaptor.capture());
        String detailsUpdate = updateCaptor.getAllValues().get(1).toBsonDocument().toJson();
        assertThat(detailsUpdate, containsString("Renamed"));
        assertThat(detailsUpdate, not(containsString("description")));
    }

    // --- updateTimelineForVersion ---

    @Test
    void throw_a_timeline_exception_when_updating_a_version_for_a_missing_timeline() {
        timelineDoesNotExist();

        assertThrows(TimelineNotFoundException.class,
                () -> store.updateTimelineForVersion(timeline("1.0.1")));
    }

    @Test
    void force_write_a_version_on_update() throws Exception {
        timelineExists();
        when(versionCollection.updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class)))
                .thenReturn(UpdateResult.acknowledged(1, 1L, null));

        store.updateTimelineForVersion(timeline("1.0.1"));

        verify(versionCollection).updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class));
        // Replacing an existing version doesn't move the count, so the only header write
        // here is the name/description update.
        verify(headerCollection).updateOne(any(Bson.class), any(Bson.class));
    }

    @Test
    void report_capacity_exceeded_when_a_version_write_hits_the_document_size_limit() {
        timelineExists();
        when(versionCollection.updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class)))
                .thenThrow(writeError(10334, "object to insert too large"));

        StorageWriteException exception = assertThrows(StorageWriteException.class,
                () -> store.updateTimelineForVersion(timeline("1.0.1")));
        assertThat(exception.isCapacityExceeded(), is(true));
    }

    @Test
    void report_a_plain_write_failure_for_other_version_write_errors() {
        timelineExists();
        when(versionCollection.updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class)))
                .thenThrow(writeError(10107, "not master"));

        StorageWriteException exception = assertThrows(StorageWriteException.class,
                () -> store.updateTimelineForVersion(timeline("1.0.1")));
        assertThat(exception.isCapacityExceeded(), is(false));
    }
}
