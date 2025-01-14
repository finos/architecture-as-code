package org.finos.calm.store.mongo;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
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
import org.bson.Document;
import org.bson.conversions.Bson;
import org.finos.calm.domain.Adr;
import org.finos.calm.domain.AdrBuilder;
import org.finos.calm.domain.AdrContentBuilder;
import org.finos.calm.domain.AdrStatus;
import org.finos.calm.domain.exception.AdrNotFoundException;
import org.finos.calm.domain.exception.AdrRevisionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@QuarkusTest
public class TestMongoAdrStoreShould {

    @InjectMock
    MongoClient mongoClient;

    @InjectMock
    MongoCounterStore counterStore;

    @InjectMock
    MongoNamespaceStore namespaceStore;

    private ObjectMapper objectMapper;

    private MongoDatabase mongoDatabase;
    private MongoCollection<Document> adrCollection;
    private MongoAdrStore mongoAdrStore;
    private final String NAMESPACE = "finos";
    private final Adr simpleAdr = AdrBuilder.builder()
            .namespace(NAMESPACE)
            .id(42)
            .revision(2)
            .adrContent(AdrContentBuilder.builder()
                    .title("My ADR")
                    .status(AdrStatus.SUPERSEDED)
                    .creationDateTime(LocalDateTime.now())
                    .updateDateTime(LocalDateTime.now())
                    .build())
            .build();

    @BeforeEach
    void setup() {
        mongoDatabase = Mockito.mock(MongoDatabase.class);
        adrCollection = Mockito.mock(MongoCollection.class);

        when(mongoClient.getDatabase("calmSchemas")).thenReturn(mongoDatabase);
        when(mongoDatabase.getCollection("adrs")).thenReturn(adrCollection);
        mongoAdrStore = new MongoAdrStore(mongoClient, counterStore, namespaceStore);

        this.objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
    }

    @Test
    void get_adrs_for_namespace_that_doesnt_exist_throws_exception() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);
        String namespace = "does-not-exist";

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoAdrStore.getAdrsForNamespace(namespace));

        verify(namespaceStore).namespaceExists(namespace);
    }

    @Test
    void get_adrs_for_namespace_returns_empty_list_when_none_exist() throws NamespaceNotFoundException {
        FindIterable<Document> findIterable = Mockito.mock(FindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(adrCollection.find(eq(Filters.eq("namespace", NAMESPACE))))
                .thenReturn(findIterable);
        Document documentMock = Mockito.mock(Document.class);
        when(findIterable.first()).thenReturn(documentMock);
        when(documentMock.getList("adrs", Document.class))
                .thenReturn(new ArrayList<>());

        assertThat(mongoAdrStore.getAdrsForNamespace(NAMESPACE), is(empty()));
        verify(namespaceStore).namespaceExists(NAMESPACE);
    }

    @Test
    void get_adrs_for_namespace_returns_empty_list_when_mongo_collection_not_created() throws NamespaceNotFoundException {
        FindIterable<Document> findIterable = Mockito.mock(FindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(adrCollection.find(eq(Filters.eq("namespace", NAMESPACE))))
                .thenReturn(findIterable);
        when(findIterable.first()).thenReturn(null);

        assertThat(mongoAdrStore.getAdrsForNamespace(NAMESPACE), is(empty()));
        verify(namespaceStore).namespaceExists(NAMESPACE);
    }

    @Test
    void get_adrs_for_namespace_returns_values() throws NamespaceNotFoundException {
        FindIterable<Document> findIterable = Mockito.mock(FindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(adrCollection.find(eq(Filters.eq("namespace", NAMESPACE))))
                .thenReturn(findIterable);
        Document documentMock = Mockito.mock(Document.class);
        when(findIterable.first()).thenReturn(documentMock);

        Document doc1 = new Document("adrId", 1001);
        Document doc2 = new Document("adrId", 1002);

        when(documentMock.getList("adrs", Document.class))
                .thenReturn(Arrays.asList(doc1, doc2));

        List<Integer> adrIds = mongoAdrStore.getAdrsForNamespace(NAMESPACE);

        assertThat(adrIds, is(Arrays.asList(1001, 1002)));
        verify(namespaceStore).namespaceExists(NAMESPACE);
    }

    @Test
    void return_a_namespace_exception_when_namespace_does_not_exist_when_creating_an_adr() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);
        String namespace = "does-not-exist";
        Adr adr = AdrBuilder.builder().namespace(namespace).build();

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoAdrStore.createAdrForNamespace(adr));
        verify(namespaceStore).namespaceExists(namespace);
    }

    @Test
    void return_created_adr_when_parameters_are_valid() throws NamespaceNotFoundException, JsonProcessingException {
        String validNamespace = NAMESPACE;
        int sequenceNumber = 42;
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(counterStore.getNextAdrSequenceValue()).thenReturn(sequenceNumber);
        Adr adrToCreate = AdrBuilder.builder()
                .adrContent(AdrContentBuilder.builder().build())
                .namespace(validNamespace)
                .revision(1)
                .build();

        Adr adr = mongoAdrStore.createAdrForNamespace(adrToCreate);

        Adr expectedAdr = AdrBuilder.builder()
                .adrContent(AdrContentBuilder.builder().build())
                .namespace(validNamespace)
                .revision(1)
                .id(sequenceNumber)
                .build();

        assertThat(adr, is(expectedAdr));
        Document expectedDoc = new Document("adrId", adr.id()).append("revisions",
                new Document("1", Document.parse(objectMapper.writeValueAsString(adr.adrContent()))));

        verify(adrCollection).updateOne(
                eq(Filters.eq("namespace", validNamespace)),
                eq(Updates.push("adrs", expectedDoc)),
                any(UpdateOptions.class));
    }

    @Test
    void get_adr_revisions_for_invalid_namespace_throws_exception() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);
        Adr adr = AdrBuilder.builder().namespace("does-not-exist").build();

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoAdrStore.getAdrRevisions(adr));

        verify(namespaceStore).namespaceExists(adr.namespace());
    }

    private FindIterable<Document> setupInvalidAdr() {
        FindIterable<Document> findIterable = Mockito.mock(FindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        //Return the same find iterable as the projection unboxes, then return null
        when(adrCollection.find(any(Bson.class)))
                .thenReturn(findIterable);
        when(findIterable.projection(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(null);

        return findIterable;
    }

    @Test
    void get_adr_revisions_for_invalid_adr_throws_exception() {
        FindIterable<Document> findIterable = setupInvalidAdr();
        Adr adr = AdrBuilder.builder().namespace(NAMESPACE).build();

        assertThrows(AdrNotFoundException.class,
                () -> mongoAdrStore.getAdrRevisions(adr));

        verify(adrCollection).find(new Document("namespace", adr.namespace()));
        verify(findIterable).projection(Projections.fields(Projections.include("adrs")));
    }

    @Test
    void get_adr_revisions_for_valid_adr_returns_list_of_revisions() throws NamespaceNotFoundException, AdrNotFoundException, JsonProcessingException {
        mockSetupAdrDocumentWithRevisions();

        Adr adr = AdrBuilder.builder().namespace(NAMESPACE).id(42).build();
        List<Integer> adrRevisions = mongoAdrStore.getAdrRevisions(adr);

        assertThat(adrRevisions, is(List.of(1)));
    }

    @Test
    void get_adr_revision_for_invalid_namespace_throws_exception() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);
        Adr adr = AdrBuilder.builder().namespace("does-not-exist").build();

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoAdrStore.getAdrRevision(adr));

        verify(namespaceStore).namespaceExists(adr.namespace());
    }

    @Test
    void throw_an_exception_for_an_invalid_adr_when_retrieving_adr_revision() {
        FindIterable<Document> findIterable = setupInvalidAdr();
        Adr adr = AdrBuilder.builder().namespace(NAMESPACE).build();

        assertThrows(AdrNotFoundException.class,
                () -> mongoAdrStore.getAdrRevision(adr));

        verify(adrCollection).find(new Document("namespace", adr.namespace()));
        verify(findIterable).projection(Projections.fields(Projections.include("adrs")));
    }

    @Test
    void return_an_adr_revision() throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, JsonProcessingException {
        mockSetupAdrDocumentWithRevisions();

        Adr adr = AdrBuilder.builder().namespace(NAMESPACE)
                .id(42).revision(1).build();

        String adrRevision = mongoAdrStore.getAdrRevision(adr);
        assertThat(adrRevision.replaceAll("\\s+", ""), is(objectMapper.writeValueAsString(simpleAdr.adrContent()).replaceAll("\\s+", "")));
    }

    private void mockSetupAdrDocumentWithRevisions() throws JsonProcessingException {
        Document mainDocument = setupAdrRevisionDocument();
        FindIterable<Document> findIterable = Mockito.mock(FindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(adrCollection.find(any(Bson.class)))
                .thenReturn(findIterable);
        when(findIterable.projection(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(mainDocument);
    }

    private Document setupAdrRevisionDocument() throws JsonProcessingException {
        //Set up an ADR document with 2 ADRs in (one with a valid revision)
        Map<String, Document> revisionMap = new HashMap<>();
        revisionMap.put("1", Document.parse(objectMapper.writeValueAsString(simpleAdr.adrContent())));
        Document targetStoredAdr = new Document("adrId", 42)
                .append("revisions", new Document(revisionMap));

        Document paddingAdr = new Document("adrId", 0);

        return new Document("namespace", NAMESPACE)
                .append("adrs", Arrays.asList(paddingAdr, targetStoredAdr));
    }

    @Test
    void throw_an_exception_when_revision_of_adr_does_not_exist() throws JsonProcessingException {
        mockSetupAdrDocumentWithRevisions();

        Adr adr = AdrBuilder.builder().namespace(NAMESPACE)
                .id(42).revision(9).build();

        assertThrows(AdrRevisionNotFoundException.class,
                () -> mongoAdrStore.getAdrRevision(adr));
    }

    @Test
    void throw_an_exception_when_no_revision_exists_when_getting_adr()  {
        mockSetupAdrDocumentWithNoRevisions();

        Adr adr = AdrBuilder.builder().namespace(NAMESPACE)
                .id(42).revision(1).build();

        assertThrows(AdrRevisionNotFoundException.class,
                () -> mongoAdrStore.getAdr(adr));
    }

    private Document setupAdrWithNoRevisions() {
        //Set up an ADR document with 1 ADR with No Revisions

        Document targetStoredAdr = new Document("adrId", 42);

        return new Document("namespace", NAMESPACE)
                .append("adrs", List.of(targetStoredAdr));
    }

    private void mockSetupAdrDocumentWithNoRevisions() {
        Document mainDocument = setupAdrWithNoRevisions();
        FindIterable<Document> findIterable = Mockito.mock(FindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(adrCollection.find(any(Bson.class)))
                .thenReturn(findIterable);
        when(findIterable.projection(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(mainDocument);
    }

    @Test
    void throw_an_exception_for_an_invalid_adr_when_retrieving_adr() {
        FindIterable<Document> findIterable = setupInvalidAdr();
        Adr adr = AdrBuilder.builder().namespace(NAMESPACE).id(7).build();

        assertThrows(AdrNotFoundException.class,
                () -> mongoAdrStore.getAdr(adr));

        verify(adrCollection).find(new Document("namespace", adr.namespace()));
        verify(findIterable).projection(Projections.fields(Projections.include("adrs")));
    }

    @Test
    void get_adr_for_invalid_namespace_throws_exception() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);
        Adr adr = AdrBuilder.builder().namespace("does-not-exist").build();

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoAdrStore.getAdr(adr));

        verify(namespaceStore).namespaceExists(adr.namespace());
    }

    @Test
    void return_the_latest_adr_revision() throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, JsonProcessingException {
        mockSetupAdrDocumentWithRevisions();

        Adr adr = AdrBuilder.builder().namespace(NAMESPACE)
                .id(42).build();

        Adr latestAdr = mongoAdrStore.getAdr(adr);
        Adr expectedAdr = AdrBuilder.builder(simpleAdr).revision(1).build();
        assertEquals(expectedAdr, latestAdr);
    }

    @Test
    void throw_an_exception_when_update_adr_with_a_namespace_that_doesnt_exists() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);

        Adr adr = AdrBuilder.builder()
                .namespace(NAMESPACE)
                .id(42)
                .build();

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoAdrStore.updateAdrForNamespace(adr));

        verify(namespaceStore, times(1)).namespaceExists(adr.namespace());
    }

    @Test
    void throw_an_exception_when_updating_an_adr_that_doesnt_exist() throws JsonProcessingException {
        mockSetupAdrDocumentWithRevisions();

        Adr adr = AdrBuilder.builder()
                .namespace(NAMESPACE)
                .id(22)
                .build();

        assertThrows(AdrNotFoundException.class,
                () -> mongoAdrStore.updateAdrForNamespace(adr));
    }

    @Test
    void throw_an_exception_when_updating_an_adr_but_no_revisions_exist() {
        mockSetupAdrDocumentWithNoRevisions();

        Adr adr = AdrBuilder.builder()
                .namespace(NAMESPACE)
                .id(42)
                .adrContent(AdrContentBuilder.builder().build())
                .build();

        assertThrows(AdrRevisionNotFoundException.class,
                () -> mongoAdrStore.updateAdrForNamespace(adr));
    }

    @Test
    void return_successfully_when_correctly_updating_an_adr() throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, JsonProcessingException {
        mockSetupAdrDocumentWithRevisions();
        Adr adr = AdrBuilder.builder()
                .namespace(NAMESPACE)
                .id(42)
                .revision(2)
                .adrContent(AdrContentBuilder.builder().build())
                .build();

        mongoAdrStore.updateAdrForNamespace(adr);

        verify(adrCollection, times(1)).updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class));
    }
}
