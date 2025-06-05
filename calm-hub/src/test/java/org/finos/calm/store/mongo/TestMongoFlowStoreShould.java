package org.finos.calm.store.mongo;

import com.mongodb.MongoWriteException;
import com.mongodb.ServerAddress;
import com.mongodb.WriteError;
import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Projections;
import com.mongodb.client.model.UpdateOptions;
import com.mongodb.client.model.Updates;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.bson.BsonDocument;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.bson.json.JsonParseException;
import org.finos.calm.domain.Flow;
import org.finos.calm.domain.exception.FlowNotFoundException;
import org.finos.calm.domain.exception.FlowVersionExistsException;
import org.finos.calm.domain.exception.FlowVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
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
public class TestMongoFlowStoreShould {

    @InjectMock
    MongoClient mongoClient;

    @InjectMock
    MongoCounterStore counterStore;

    @InjectMock
    MongoNamespaceStore namespaceStore;

    private MongoCollection<Document> flowCollection;
    private MongoFlowStore mongoFlowStore;
    private final String NAMESPACE = "finos";

    private final String validJson = "{\"test\": \"test\"}";
    @BeforeEach
    void setup() {
        MongoDatabase mongoDatabase = Mockito.mock(MongoDatabase.class);
        flowCollection = Mockito.mock(MongoCollection.class);

        when(mongoClient.getDatabase("calmSchemas")).thenReturn(mongoDatabase);
        when(mongoDatabase.getCollection("flows")).thenReturn(flowCollection);
        mongoFlowStore = new MongoFlowStore(mongoClient, counterStore, namespaceStore);
    }

    @Test
    void get_flow_for_namespace_that_doesnt_exist_throws_exception() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);
        String namespace = "does-not-exist";

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoFlowStore.getFlowsForNamespace(namespace));

        verify(namespaceStore).namespaceExists(namespace);
    }


    @Test
    void get_flows_for_namespace_returns_empty_list_when_none_exist() throws NamespaceNotFoundException {
        FindIterable<Document> findIterable = Mockito.mock(FindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(flowCollection.find(eq(Filters.eq("namespace", NAMESPACE))))
                .thenReturn(findIterable);
        Document documentMock = Mockito.mock(Document.class);
        when(findIterable.first()).thenReturn(documentMock);
        when(documentMock.getList("flows", Document.class))
                .thenReturn(new ArrayList<>());

        assertThat(mongoFlowStore.getFlowsForNamespace(NAMESPACE), is(empty()));
        verify(namespaceStore).namespaceExists(NAMESPACE);
    }

    @Test
    void get_flows_for_namespace_returns_empty_list_when_mongo_collection_not_created() throws NamespaceNotFoundException {
        FindIterable<Document> findIterable = Mockito.mock(FindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(flowCollection.find(eq(Filters.eq("namespace", NAMESPACE))))
                .thenReturn(findIterable);
        when(findIterable.first()).thenReturn(null);

        assertThat(mongoFlowStore.getFlowsForNamespace(NAMESPACE), is(empty()));
        verify(namespaceStore).namespaceExists(NAMESPACE);
    }



    @Test
    void get_flow_for_namespace_returns_values() throws NamespaceNotFoundException {
        FindIterable<Document> findIterable = Mockito.mock(FindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(flowCollection.find(eq(Filters.eq("namespace", NAMESPACE))))
                .thenReturn(findIterable);
        Document documentMock = Mockito.mock(Document.class);
        when(findIterable.first()).thenReturn(documentMock);

        Document doc1 = new Document("flowId", 1001);
        Document doc2 = new Document("flowId", 1002);

        when(documentMock.getList("flows", Document.class))
                .thenReturn(Arrays.asList(doc1, doc2));

        List<Integer> flowIds = mongoFlowStore.getFlowsForNamespace(NAMESPACE);

        assertThat(flowIds, is(Arrays.asList(1001, 1002)));
        verify(namespaceStore).namespaceExists(NAMESPACE);
    }

    @Test
    void return_a_namespace_exception_when_namespace_does_not_exist_when_creating_an_flow() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);
        String namespace = "does-not-exist";
        Flow flow = new Flow.FlowBuilder().setNamespace(namespace).build();

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoFlowStore.createFlowForNamespace(flow));

        verify(namespaceStore).namespaceExists(namespace);
    }

    @Test
    void return_a_json_parse_exception_when_an_invalid_json_object_is_presented() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(counterStore.getNextFlowSequenceValue()).thenReturn(42);
        Flow flow = new Flow.FlowBuilder().setNamespace(NAMESPACE)
                .setFlow("Invalid JSON")
                .build();

        assertThrows(JsonParseException.class,
                () -> mongoFlowStore.createFlowForNamespace(flow));
    }

    @Test
    void return_created_flow_when_parameters_are_valid() throws NamespaceNotFoundException {
        String validNamespace = NAMESPACE;
        int sequenceNumber = 42;
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(counterStore.getNextFlowSequenceValue()).thenReturn(sequenceNumber);
        Flow flowToCreate = new Flow.FlowBuilder().setFlow(validJson)
                .setNamespace(validNamespace)
                .build();

        Flow flow = mongoFlowStore.createFlowForNamespace(flowToCreate);

        Flow expectedFlow = new Flow.FlowBuilder().setFlow(validJson)
                .setNamespace(validNamespace)
                .setVersion("1.0.0")
                .setId(sequenceNumber)
                .build();

        assertThat(flow, is(expectedFlow));
        Document expectedDoc = new Document("flowId", flow.getId()).append("versions",
                new Document("1-0-0", Document.parse(flow.getFlowJson())));

        verify(flowCollection).updateOne(
                eq(Filters.eq("namespace", validNamespace)),
                eq(Updates.push("flows", expectedDoc)),
                any(UpdateOptions.class));
    }

    @Test
    void get_flow_version_for_invalid_namespace_throws_exception() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);
        Flow flow = new Flow.FlowBuilder().setNamespace("does-not-exist").build();

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoFlowStore.getFlowVersions(flow));

        verify(namespaceStore).namespaceExists(flow.getNamespace());
    }

    private FindIterable<Document> setupInvalidFlow() {
        FindIterable<Document> findIterable = Mockito.mock(FindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        //Return the same find iterable as the projection unboxes, then return null
        when(flowCollection.find(any(Bson.class)))
                .thenReturn(findIterable);
        when(findIterable.projection(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(null);


        return findIterable;
    }

    @Test
    void get_flow_version_for_invalid_pattern_throws_exception() {
        FindIterable<Document> findIterable = setupInvalidFlow();
        Flow flow = new Flow.FlowBuilder().setNamespace(NAMESPACE).build();

        assertThrows(FlowNotFoundException.class,
                () -> mongoFlowStore.getFlowVersions(flow));

        verify(flowCollection).find(new Document("namespace", flow.getNamespace()));
        verify(findIterable).projection(Projections.fields(Projections.include("flows")));
    }

    @Test
    void get_flow_versions_for_valid_flow_returns_list_of_versions() throws FlowNotFoundException, NamespaceNotFoundException {
        mockSetupFlowDocumentWithVersions();

        Flow flow = new Flow.FlowBuilder().setNamespace(NAMESPACE).setId(42).build();
        List<String> flowVersions = mongoFlowStore.getFlowVersions(flow);

        assertThat(flowVersions, is(List.of("1.0.0")));
    }

    @Test
    void throw_an_exception_for_an_invalid_namespace_when_retrieving_flow_for_version() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);
        Flow flow = new Flow.FlowBuilder().setNamespace("does-not-exist").build();

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoFlowStore.getFlowVersions(flow));

        verify(namespaceStore).namespaceExists(flow.getNamespace());
    }

    @Test
    void throw_an_exception_for_an_invalid_flow_when_retrieving_flow_for_version() {
        FindIterable<Document> findIterable = setupInvalidFlow();
        Flow flow = new Flow.FlowBuilder().setNamespace(NAMESPACE).build();

        assertThrows(FlowNotFoundException.class,
                () -> mongoFlowStore.getFlowForVersion(flow));

        verify(flowCollection).find(new Document("namespace", flow.getNamespace()));
        verify(findIterable).projection(Projections.fields(Projections.include("flows")));
    }

    @Test
    void return_an_flow_for_a_given_version() throws FlowNotFoundException, FlowVersionNotFoundException, NamespaceNotFoundException {
        mockSetupFlowDocumentWithVersions();

        Flow flow = new Flow.FlowBuilder().setNamespace(NAMESPACE)
                .setId(42).setVersion("1.0.0").build();

        String flowForVersion = mongoFlowStore.getFlowForVersion(flow);
        assertThat(flowForVersion, is(validJson));
    }


    private Document setupFlowVersionDocument() {
        //Set up an flow document with 2 flows in (one with a valid version)
        Map<String, Document> versionMap = new HashMap<>();
        versionMap.put("1-0-0", Document.parse(validJson));
        Document targetStoredFlow = new Document("flowId", 42)
                .append("versions", new Document(versionMap));

        Document paddingFlow = new Document("flowId", 0);

        return new Document("namespace", NAMESPACE)
                .append("flows", Arrays.asList(paddingFlow, targetStoredFlow));
    }

    private void mockSetupFlowDocumentWithVersions() {
        Document mainDocument = setupFlowVersionDocument();
        FindIterable<Document> findIterable = Mockito.mock(FindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(flowCollection.find(any(Bson.class)))
                .thenReturn(findIterable);
        when(findIterable.projection(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(mainDocument);
    }

    @Test
    void throw_an_exception_when_flow_for_given_version_does_not_exist()  {
        mockSetupFlowDocumentWithVersions();

        Flow flow = new Flow.FlowBuilder().setNamespace(NAMESPACE)
                .setId(42).setVersion("9.0.0").build();

        assertThrows(FlowVersionNotFoundException.class,
                () -> mongoFlowStore.getFlowForVersion(flow));
    }

    @Test
    void throw_an_exception_when_create_or_update_flow_for_version_with_a_namespace_that_doesnt_exists() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);

        Flow flow = new Flow.FlowBuilder().setNamespace(NAMESPACE)
                .setId(42).setVersion("9.0.0").build();

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoFlowStore.createFlowForVersion(flow));
        assertThrows(NamespaceNotFoundException.class,
                () -> mongoFlowStore.updateFlowForVersion(flow));

        verify(namespaceStore, times(2)).namespaceExists(flow.getNamespace());
    }

    @Test
    void throw_an_exception_when_create_on_a_version_that_exists() {
        mockSetupFlowDocumentWithVersions();

        Flow flow = new Flow.FlowBuilder().setNamespace(NAMESPACE)
                .setId(42).setVersion("1.0.0").build();

        assertThrows(FlowVersionExistsException.class,
                () -> mongoFlowStore.createFlowForVersion(flow));
    }

    @Test
    void throw_an_flow_not_found_exception_when_creating_or_updating_a_version() {
        mockSetupFlowDocumentWithVersions();
        Flow flow = new Flow.FlowBuilder().setNamespace(NAMESPACE)
                .setId(50).setVersion("1.0.1")
                .setFlow(validJson).build();

        WriteError writeError = new WriteError(2, "The positional operator did not find the match needed from the query", new BsonDocument());
        MongoWriteException mongoWriteException = new MongoWriteException(writeError, new ServerAddress());

        when(flowCollection.updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class)))
                .thenThrow(mongoWriteException);

        assertThrows(FlowNotFoundException.class,
                () -> mongoFlowStore.createFlowForVersion(flow));
        assertThrows(FlowNotFoundException.class,
                () -> mongoFlowStore.updateFlowForVersion(flow));
    }

    @Test
    void accept_the_creation_or_update_of_a_valid_version() throws FlowNotFoundException, NamespaceNotFoundException, FlowVersionExistsException {
        mockSetupFlowDocumentWithVersions();
        Flow flow = new Flow.FlowBuilder().setNamespace(NAMESPACE)
                .setId(50).setVersion("1.0.1")
                .setFlow(validJson).build();

        mongoFlowStore.updateFlowForVersion(flow);
        mongoFlowStore.createFlowForVersion(flow);

        verify(flowCollection, times(2)).updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class));
    }
}
