package org.finos.calm.store.mongo;

import com.mongodb.MongoWriteException;
import com.mongodb.ServerAddress;
import com.mongodb.WriteError;
import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Projections;
import com.mongodb.client.model.UpdateOptions;
import com.mongodb.client.model.Updates;
import com.mongodb.client.result.UpdateResult;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.bson.BsonDocument;
import org.bson.Document;
import org.bson.conversions.Bson;
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
import org.mockito.Mockito;

import java.util.*;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@QuarkusTest
public class TestMongoTimelineStoreShould {

    @InjectMock
    MongoDatabase mongoDatabase;

    @InjectMock
    MongoCounterStore counterStore;

    @InjectMock
    MongoNamespaceStore namespaceStore;

    private MongoCollection<Document> timelineCollection;
    private MongoTimelineStore mongoTimelineStore;
    private final String NAMESPACE = "finos";

    private final String validJson = "{\"test\": \"test\"}";

    @BeforeEach
    void setup() {
        timelineCollection = Mockito.mock(DocumentMongoCollection.class);

        when(mongoDatabase.getCollection("timelines")).thenReturn(timelineCollection);
        mongoTimelineStore = new MongoTimelineStore(mongoDatabase, counterStore, namespaceStore);
    }

    @Test
    void get_timelines_for_namespace_returns_empty_list_when_none_exist() throws NamespaceNotFoundException {
        FindIterable<Document> findIterable = Mockito.mock(DocumentFindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(timelineCollection.find(eq(Filters.eq("namespace", NAMESPACE))))
                .thenReturn(findIterable);
        Document documentMock = Mockito.mock(Document.class);
        when(findIterable.first()).thenReturn(documentMock);
        when(documentMock.getList("timelines", Document.class))
                .thenReturn(new ArrayList<>());

        assertThat(mongoTimelineStore.getTimelinesForNamespace(NAMESPACE), is(empty()));
        verify(namespaceStore).namespaceExists(NAMESPACE);
    }

    @Test
    void get_timelines_for_namespace_returns_empty_list_when_mongo_collection_not_created() throws NamespaceNotFoundException {
        FindIterable<Document> findIterable = Mockito.mock(DocumentFindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(timelineCollection.find(eq(Filters.eq("namespace", NAMESPACE))))
                .thenReturn(findIterable);
        when(findIterable.first()).thenReturn(null);

        assertThat(mongoTimelineStore.getTimelinesForNamespace(NAMESPACE), is(empty()));
        verify(namespaceStore).namespaceExists(NAMESPACE);
    }

    @Test
    void get_timeline_for_namespace_that_doesnt_exist_throws_exception() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);
        String namespace = "does-not-exist";

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoTimelineStore.getTimelinesForNamespace(namespace));

        verify(namespaceStore).namespaceExists(namespace);
    }

    @Test
    void get_timeline_for_namespace_returns_values() throws NamespaceNotFoundException {
        FindIterable<Document> findIterable = Mockito.mock(DocumentFindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(timelineCollection.find(eq(Filters.eq("namespace", NAMESPACE))))
                .thenReturn(findIterable);
        Document documentMock = Mockito.mock(Document.class);
        when(findIterable.first()).thenReturn(documentMock);

        Document doc1 = new Document("timelineId", 1001).append("name", "Timeline One").append("description", "First timeline");
        Document doc2 = new Document("timelineId", 1002).append("name", "Timeline Two").append("description", "Second timeline");

        when(documentMock.getList("timelines", Document.class))
                .thenReturn(Arrays.asList(doc1, doc2));

        List<NamespaceTimelineSummary> timelines = mongoTimelineStore.getTimelinesForNamespace(NAMESPACE);

        assertThat(timelines.size(), is(2));
        assertThat(timelines.get(0).getName(), is("Timeline One"));
        assertThat(timelines.get(0).getDescription(), is("First timeline"));
        assertThat(timelines.get(0).getId(), is(1001));
        assertThat(timelines.get(1).getName(), is("Timeline Two"));
        assertThat(timelines.get(1).getDescription(), is("Second timeline"));
        assertThat(timelines.get(1).getId(), is(1002));
        verify(namespaceStore).namespaceExists(NAMESPACE);
    }

    @Test
    void get_timeline_for_namespace_returns_fallback_for_legacy_documents() throws NamespaceNotFoundException {
        FindIterable<Document> findIterable = Mockito.mock(DocumentFindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(timelineCollection.find(eq(Filters.eq("namespace", NAMESPACE))))
                .thenReturn(findIterable);
        Document documentMock = Mockito.mock(Document.class);
        when(findIterable.first()).thenReturn(documentMock);

        // Legacy document without name or description
        Document legacyDoc = new Document("timelineId", 77);

        when(documentMock.getList("timelines", Document.class))
                .thenReturn(List.of(legacyDoc));

        List<NamespaceTimelineSummary> timelines = mongoTimelineStore.getTimelinesForNamespace(NAMESPACE);

        assertThat(timelines.size(), is(1));
        assertThat(timelines.get(0).getName(), is("Timeline 77"));
        assertThat(timelines.get(0).getDescription(), is(""));
        assertThat(timelines.get(0).getId(), is(77));
    }

    private FindIterable<Document> setupInvalidTimeline() {
        FindIterable<Document> findIterable = Mockito.mock(DocumentFindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(timelineCollection.find(any(Bson.class)))
                .thenReturn(findIterable);
        when(findIterable.projection(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(null);

        return findIterable;
    }

    private void mockSetupTimelineDocumentWithVersions() {
        Document mainDocument = setupTimelineVersionDocument();
        FindIterable<Document> findIterable = Mockito.mock(DocumentFindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(timelineCollection.find(any(Bson.class)))
                .thenReturn(findIterable);
        when(findIterable.projection(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(mainDocument);
    }

    @Test
    void return_a_namespace_exception_when_namespace_does_not_exist_when_creating_a_timeline() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);
        String namespace = "does-not-exist";
        CreateTimelineRequest request = new CreateTimelineRequest("name", "desc", validJson);

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoTimelineStore.createTimelineForNamespace(request, namespace));

        verify(namespaceStore).namespaceExists(namespace);
    }

    @Test
    void return_a_json_parse_exception_when_an_invalid_json_object_is_presented() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(counterStore.getNextTimelineSequenceValue()).thenReturn(42);
        CreateTimelineRequest request = new CreateTimelineRequest("name", "desc", "Invalid JSON");

        assertThrows(JsonParseException.class,
                () -> mongoTimelineStore.createTimelineForNamespace(request, NAMESPACE));
    }

    @Test
    void return_created_timeline_when_parameters_are_valid() throws NamespaceNotFoundException {
        String validNamespace = NAMESPACE;
        int sequenceNumber = 42;
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(counterStore.getNextTimelineSequenceValue()).thenReturn(sequenceNumber);
        CreateTimelineRequest request = new CreateTimelineRequest("Test Timeline", "A test", validJson);

        Timeline timeline = mongoTimelineStore.createTimelineForNamespace(request, validNamespace);

        Timeline expectedTimeline = new Timeline.TimelineBuilder().setTimeline(validJson)
                .setNamespace(validNamespace)
                .setVersion("1.0.0")
                .setId(sequenceNumber)
                .build();

        assertThat(timeline, is(expectedTimeline));
        Document expectedDoc = new Document("timelineId", timeline.getId())
                .append("name", "Test Timeline")
                .append("description", "A test")
                .append("versions",
                        new Document("1-0-0", Document.parse(timeline.getTimelineJson())));

        verify(timelineCollection).updateOne(
                eq(Filters.eq("namespace", validNamespace)),
                eq(Updates.push("timelines", expectedDoc)),
                any(UpdateOptions.class));
    }

    @Test
    void get_timeline_version_for_invalid_namespace_throws_exception() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);
        Timeline timeline = new Timeline.TimelineBuilder().setNamespace("does-not-exist").build();

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoTimelineStore.getTimelineVersions(timeline));

        verify(namespaceStore).namespaceExists(timeline.getNamespace());
    }

    private interface DocumentFindIterable extends FindIterable<Document> {
    }

    @Test
    void get_timeline_version_for_invalid_timeline_throws_exception() {
        FindIterable<Document> findIterable = setupInvalidTimeline();
        Timeline timeline = new Timeline.TimelineBuilder().setNamespace(NAMESPACE).build();

        assertThrows(TimelineNotFoundException.class,
                () -> mongoTimelineStore.getTimelineVersions(timeline));

        verify(timelineCollection).find(new Document("namespace", timeline.getNamespace()));
        verify(findIterable).projection(Projections.fields(Projections.include("timelines")));
    }

    @Test
    void throw_timeline_not_found_when_versions_document_is_missing_on_get_versions() {
        Document timelineWithNoVersions = new Document("namespace", NAMESPACE)
                .append("timelines", List.of(new Document("timelineId", 42)));
        FindIterable<Document> findIterable = Mockito.mock(DocumentFindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(timelineCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.projection(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(timelineWithNoVersions);

        Timeline timeline = new Timeline.TimelineBuilder().setNamespace(NAMESPACE).setId(42).build();

        assertThrows(TimelineNotFoundException.class,
                () -> mongoTimelineStore.getTimelineVersions(timeline));
    }

    @Test
    void throw_timeline_version_not_found_when_versions_document_is_missing_on_get_for_version() {
        Document timelineWithNoVersions = new Document("namespace", NAMESPACE)
                .append("timelines", List.of(new Document("timelineId", 42)));
        FindIterable<Document> findIterable = Mockito.mock(DocumentFindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(timelineCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.projection(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(timelineWithNoVersions);

        Timeline timeline = new Timeline.TimelineBuilder().setNamespace(NAMESPACE).setId(42).setVersion("1.0.0").build();

        assertThrows(TimelineVersionNotFoundException.class,
                () -> mongoTimelineStore.getTimelineForVersion(timeline));
    }

    @Test
    void get_timeline_versions_for_valid_timeline_returns_list_of_versions() throws TimelineNotFoundException, NamespaceNotFoundException {
        mockSetupTimelineDocumentWithVersions();

        Timeline timeline = new Timeline.TimelineBuilder().setNamespace(NAMESPACE).setId(42).build();
        List<String> timelineVersions = mongoTimelineStore.getTimelineVersions(timeline);

        assertThat(timelineVersions, is(List.of("1.0.0")));
    }

    @Test
    void throw_an_exception_for_an_invalid_timeline_when_retrieving_timeline_for_version() {
        FindIterable<Document> findIterable = setupInvalidTimeline();
        Timeline timeline = new Timeline.TimelineBuilder().setNamespace(NAMESPACE).build();

        assertThrows(TimelineNotFoundException.class,
                () -> mongoTimelineStore.getTimelineForVersion(timeline));

        verify(timelineCollection).find(new Document("namespace", timeline.getNamespace()));
        verify(findIterable).projection(Projections.fields(Projections.include("timelines")));
    }

    @Test
    void return_a_timeline_for_a_given_version() throws TimelineNotFoundException, TimelineVersionNotFoundException, NamespaceNotFoundException {
        mockSetupTimelineDocumentWithVersions();

        Timeline timeline = new Timeline.TimelineBuilder().setNamespace(NAMESPACE)
                .setId(42).setVersion("1.0.0").build();

        String timelineForVersion = mongoTimelineStore.getTimelineForVersion(timeline);
        assertThat(timelineForVersion, is(validJson));
    }

    private Document setupTimelineVersionDocument() {
        Map<String, Document> versionMap = new HashMap<>();
        versionMap.put("1-0-0", Document.parse(validJson));
        Document targetStoredTimeline = new Document("timelineId", 42)
                .append("versions", new Document(versionMap));

        Document paddingTimeline = new Document("timelineId", 0);

        return new Document("namespace", NAMESPACE)
                .append("timelines", Arrays.asList(paddingTimeline, targetStoredTimeline));
    }

    private interface DocumentMongoCollection extends MongoCollection<Document> {
    }

    @Test
    void throw_an_exception_when_timeline_for_given_version_does_not_exist() {
        mockSetupTimelineDocumentWithVersions();

        Timeline timeline = new Timeline.TimelineBuilder().setNamespace(NAMESPACE)
                .setId(42).setVersion("9.0.0").build();

        assertThrows(TimelineVersionNotFoundException.class,
                () -> mongoTimelineStore.getTimelineForVersion(timeline));
    }

    @Test
    void throw_an_exception_when_create_or_update_timeline_for_version_with_a_namespace_that_doesnt_exist() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);

        Timeline timeline = new Timeline.TimelineBuilder().setNamespace(NAMESPACE)
                .setId(42).setVersion("9.0.0").build();

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoTimelineStore.createTimelineForVersion(timeline));
        assertThrows(NamespaceNotFoundException.class,
                () -> mongoTimelineStore.updateTimelineForVersion(timeline));

        verify(namespaceStore, times(2)).namespaceExists(timeline.getNamespace());
    }

    @Test
    void throw_an_exception_when_create_on_a_version_that_exists() {
        mockSetupTimelineDocumentWithVersions();

        when(timelineCollection.updateOne(any(Bson.class), any(Bson.class)))
                .thenReturn(UpdateResult.acknowledged(0, 0L, null));

        Timeline timeline = new Timeline.TimelineBuilder().setNamespace(NAMESPACE)
                .setId(42).setVersion("1.0.0").setTimeline(validJson).build();

        assertThrows(TimelineVersionExistsException.class,
                () -> mongoTimelineStore.createTimelineForVersion(timeline));
    }

    @Test
    void throw_a_timeline_not_found_exception_when_creating_or_updating_a_version() {
        mockSetupTimelineDocumentWithVersions();
        Timeline timeline = new Timeline.TimelineBuilder().setNamespace(NAMESPACE)
                .setId(50).setVersion("1.0.1")
                .setTimeline(validJson).build();

        WriteError writeError = new WriteError(2, "The positional operator did not find the match needed from the query", new BsonDocument());
        MongoWriteException mongoWriteException = new MongoWriteException(writeError, new ServerAddress(), Set.of("label"));

        when(timelineCollection.updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class)))
                .thenThrow(mongoWriteException);

        assertThrows(TimelineNotFoundException.class,
                () -> mongoTimelineStore.createTimelineForVersion(timeline));
        assertThrows(TimelineNotFoundException.class,
                () -> mongoTimelineStore.updateTimelineForVersion(timeline));
    }

    @Test
    void accept_the_creation_or_update_of_a_valid_version() throws TimelineNotFoundException, NamespaceNotFoundException, TimelineVersionExistsException {
        mockSetupTimelineDocumentWithVersions();

        when(timelineCollection.updateOne(any(Bson.class), any(Bson.class)))
                .thenReturn(UpdateResult.acknowledged(1, 1L, null));

        Timeline timeline = new Timeline.TimelineBuilder().setNamespace(NAMESPACE)
                .setId(42).setVersion("1.0.1")
                .setTimeline(validJson).build();

        mongoTimelineStore.updateTimelineForVersion(timeline);
        mongoTimelineStore.createTimelineForVersion(timeline);

        verify(timelineCollection).updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class));
        verify(timelineCollection).updateOne(any(Bson.class), any(Bson.class));
    }
}
