package org.finos.calm.store.mongo;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
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
import org.finos.calm.domain.adr.Adr;
import org.finos.calm.domain.adr.AdrMeta;
import org.finos.calm.domain.adr.Status;
import org.finos.calm.domain.exception.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.time.LocalDateTime;
import java.util.*;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@QuarkusTest
public class TestMongoAdrStoreShould {

    @InjectMock
    MongoClient mongoClient;

    @InjectMock
    MongoCounterStore counterStore;

    @InjectMock
    MongoNamespaceStore namespaceStore;

    private ObjectMapper objectMapper;

    private final String NAMESPACE = "finos";
    private final AdrMeta simpleAdrMeta = new AdrMeta.AdrMetaBuilder()
            .setNamespace(NAMESPACE)
            .setId(42)
            .setRevision(2)
            .setAdr(new Adr.AdrBuilder()
                    .setTitle("My ADR")
                    .setStatus(Status.superseded)
                    .setCreationDateTime(LocalDateTime.now())
                    .setUpdateDateTime(LocalDateTime.now())
                    .build())
            .build();
    private MongoCollection<Document> adrCollection;
    private MongoAdrStore mongoAdrStore;

    @BeforeEach
    void setup() {
        MongoDatabase mongoDatabase = Mockito.mock(MongoDatabase.class);
        adrCollection = Mockito.mock(DocumentMongoCollection.class);

        when(mongoClient.getDatabase("calmSchemas")).thenReturn(mongoDatabase);
        when(mongoDatabase.getCollection("adrs")).thenReturn(adrCollection);
        mongoAdrStore = new MongoAdrStore(mongoClient, counterStore, namespaceStore);

        this.objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
    }

    @Test
    void get_adrs_for_namespace_returns_empty_list_when_none_exist() throws NamespaceNotFoundException {
        FindIterable<Document> findIterable = Mockito.mock(DocumentFindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
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
        FindIterable<Document> findIterable = Mockito.mock(DocumentFindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(adrCollection.find(eq(Filters.eq("namespace", NAMESPACE))))
                .thenReturn(findIterable);
        when(findIterable.first()).thenReturn(null);

        assertThat(mongoAdrStore.getAdrsForNamespace(NAMESPACE), is(empty()));
        verify(namespaceStore).namespaceExists(NAMESPACE);
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
    void get_adrs_for_namespace_returns_values() throws NamespaceNotFoundException {
        FindIterable<Document> findIterable = Mockito.mock(DocumentFindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
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

    private FindIterable<Document> setupInvalidAdr() {
        FindIterable<Document> findIterable = Mockito.mock(DocumentFindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        //Return the same find iterable as the projection unboxes, then return null
        when(adrCollection.find(any(Bson.class)))
                .thenReturn(findIterable);
        when(findIterable.projection(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(null);

        return findIterable;
    }

    private void mockSetupAdrDocumentWithRevisions() throws JsonProcessingException {
        Document mainDocument = setupAdrRevisionDocument();
        FindIterable<Document> findIterable = Mockito.mock(DocumentFindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(adrCollection.find(any(Bson.class)))
                .thenReturn(findIterable);
        when(findIterable.projection(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(mainDocument);
    }

    @Test
    void return_a_namespace_exception_when_namespace_does_not_exist_when_creating_an_adr() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);
        String namespace = "does-not-exist";
        AdrMeta adrMeta = new AdrMeta.AdrMetaBuilder().setNamespace(namespace).build();

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoAdrStore.createAdrForNamespace(adrMeta));
        verify(namespaceStore).namespaceExists(namespace);
    }

    @Test
    void return_created_adr_when_parameters_are_valid() throws NamespaceNotFoundException, JsonProcessingException, AdrParseException {
        String validNamespace = NAMESPACE;
        int sequenceNumber = 42;
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(counterStore.getNextAdrSequenceValue()).thenReturn(sequenceNumber);
        AdrMeta adrMetaToCreate = new AdrMeta.AdrMetaBuilder()
                .setAdr(new Adr.AdrBuilder().build())
                .setNamespace(validNamespace)
                .setRevision(1)
                .build();

        AdrMeta adrMeta = mongoAdrStore.createAdrForNamespace(adrMetaToCreate);

        AdrMeta expectedAdrMeta = new AdrMeta.AdrMetaBuilder()
                .setAdr(new Adr.AdrBuilder().build())
                .setNamespace(validNamespace)
                .setRevision(1)
                .setId(sequenceNumber)
                .build();

        assertThat(adrMeta, is(expectedAdrMeta));
        Document expectedDoc = new Document("adrId", adrMeta.getId()).append("revisions",
                new Document("1", Document.parse(objectMapper.writeValueAsString(adrMeta.getAdr()))));

        verify(adrCollection).updateOne(
                eq(Filters.eq("namespace", validNamespace)),
                eq(Updates.push("adrs", expectedDoc)),
                any(UpdateOptions.class));
    }

    @Test
    void get_adr_revisions_for_invalid_namespace_throws_exception() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);
        AdrMeta adrMeta = new AdrMeta.AdrMetaBuilder().setNamespace("does-not-exist").build();

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoAdrStore.getAdrRevisions(adrMeta));

        verify(namespaceStore).namespaceExists(adrMeta.getNamespace());
    }

    private void mockSetupAdrDocumentWithNoRevisions() {
        Document mainDocument = setupAdrWithNoRevisions();
        FindIterable<Document> findIterable = Mockito.mock(DocumentFindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(adrCollection.find(any(Bson.class)))
                .thenReturn(findIterable);
        when(findIterable.projection(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(mainDocument);
    }

    @Test
    void get_adr_revisions_for_invalid_adr_throws_exception() {
        FindIterable<Document> findIterable = setupInvalidAdr();
        AdrMeta adrMeta = new AdrMeta.AdrMetaBuilder().setNamespace(NAMESPACE).build();

        assertThrows(AdrNotFoundException.class,
                () -> mongoAdrStore.getAdrRevisions(adrMeta));

        verify(adrCollection).find(new Document("namespace", adrMeta.getNamespace()));
        verify(findIterable).projection(Projections.fields(Projections.include("adrs")));
    }

    @Test
    void get_adr_revisions_for_valid_adr_returns_list_of_revisions() throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, JsonProcessingException {
        mockSetupAdrDocumentWithRevisions();

        AdrMeta adrMeta = new AdrMeta.AdrMetaBuilder().setNamespace(NAMESPACE).setId(42).build();
        List<Integer> adrRevisions = mongoAdrStore.getAdrRevisions(adrMeta);

        assertThat(adrRevisions, is(List.of(1)));
    }

    @Test
    void get_adr_revision_for_invalid_namespace_throws_exception() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);
        AdrMeta adrMeta = new AdrMeta.AdrMetaBuilder().setNamespace("does-not-exist").build();

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoAdrStore.getAdrRevision(adrMeta));

        verify(namespaceStore).namespaceExists(adrMeta.getNamespace());
    }

    @Test
    void throw_an_exception_for_an_invalid_adr_when_retrieving_adr_revision() {
        FindIterable<Document> findIterable = setupInvalidAdr();
        AdrMeta adrMeta = new AdrMeta.AdrMetaBuilder().setNamespace(NAMESPACE).build();

        assertThrows(AdrNotFoundException.class,
                () -> mongoAdrStore.getAdrRevision(adrMeta));

        verify(adrCollection).find(new Document("namespace", adrMeta.getNamespace()));
        verify(findIterable).projection(Projections.fields(Projections.include("adrs")));
    }

    @Test
    void return_an_adr_revision() throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, AdrParseException, JsonProcessingException {
        mockSetupAdrDocumentWithRevisions();

        AdrMeta adrMeta = new AdrMeta.AdrMetaBuilder().setNamespace(NAMESPACE)
                .setId(42).setRevision(1).build();

        AdrMeta adrMetaRevision = mongoAdrStore.getAdrRevision(adrMeta);
        AdrMeta expectedAdrRevisionMeta = new AdrMeta.AdrMetaBuilder(simpleAdrMeta).setRevision(1).build();
        assertThat(adrMetaRevision, is(expectedAdrRevisionMeta));
    }

    private Document setupAdrWithNoRevisions() {
        //Set up an ADR document with 1 ADR with No Revisions
        return new Document("namespace", NAMESPACE)
                .append("adrs", List.of(new Document("adrId", 42)));
    }

    private Document setupAdrRevisionDocument() throws JsonProcessingException {
        //Set up an ADR document with 2 ADRs in (one with a valid revision)
        Map<String, Document> revisionMap = new HashMap<>();
        revisionMap.put("1", Document.parse(objectMapper.writeValueAsString(simpleAdrMeta.getAdr())));
        Document targetStoredAdr = new Document("adrId", 42)
                .append("revisions", new Document(revisionMap));

        Document paddingAdr = new Document("adrId", 0);

        return new Document("namespace", NAMESPACE)
                .append("adrs", Arrays.asList(paddingAdr, targetStoredAdr));
    }

    @Test
    void throw_an_exception_when_revision_of_adr_does_not_exist() throws JsonProcessingException {
        mockSetupAdrDocumentWithRevisions();

        AdrMeta adrMeta = new AdrMeta.AdrMetaBuilder().setNamespace(NAMESPACE)
                .setId(42).setRevision(9).build();

        assertThrows(AdrRevisionNotFoundException.class,
                () -> mongoAdrStore.getAdrRevision(adrMeta));
    }

    @Test
    void throw_an_exception_when_no_revision_exists_when_getting_adr()  {
        mockSetupAdrDocumentWithNoRevisions();

        AdrMeta adrMeta = new AdrMeta.AdrMetaBuilder().setNamespace(NAMESPACE)
                .setId(42).setRevision(1).build();

        assertThrows(AdrRevisionNotFoundException.class,
                () -> mongoAdrStore.getAdr(adrMeta));
    }

    private interface DocumentFindIterable extends FindIterable<Document> {
    }

    private interface DocumentMongoCollection extends MongoCollection<Document> {
    }

    @Test
    void throw_an_exception_for_an_invalid_adr_when_retrieving_adr() {
        FindIterable<Document> findIterable = setupInvalidAdr();
        AdrMeta adrMeta = new AdrMeta.AdrMetaBuilder().setNamespace(NAMESPACE).setId(7).build();

        assertThrows(AdrNotFoundException.class,
                () -> mongoAdrStore.getAdr(adrMeta));

        verify(adrCollection).find(new Document("namespace", adrMeta.getNamespace()));
        verify(findIterable).projection(Projections.fields(Projections.include("adrs")));
    }

    @Test
    void get_adr_for_invalid_namespace_throws_exception() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);
        AdrMeta adrMeta = new AdrMeta.AdrMetaBuilder().setNamespace("does-not-exist").build();

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoAdrStore.getAdr(adrMeta));

        verify(namespaceStore).namespaceExists(adrMeta.getNamespace());
    }

    @Test
    void return_the_latest_adr_revision() throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, JsonProcessingException, AdrParseException {
        mockSetupAdrDocumentWithRevisions();

        AdrMeta adrMeta = new AdrMeta.AdrMetaBuilder().setNamespace(NAMESPACE)
                .setId(42).build();

        AdrMeta latestAdrMeta = mongoAdrStore.getAdr(adrMeta);
        AdrMeta expectedAdrMeta = new AdrMeta.AdrMetaBuilder(simpleAdrMeta).setRevision(1).build();
        assertThat(latestAdrMeta, is(expectedAdrMeta));
    }

    @Test
    void throw_an_exception_when_update_adr_with_a_namespace_that_doesnt_exists() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);

        AdrMeta adrMeta = new AdrMeta.AdrMetaBuilder()
                .setNamespace(NAMESPACE)
                .setId(42)
                .build();

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoAdrStore.updateAdrForNamespace(adrMeta));

        verify(namespaceStore, times(1)).namespaceExists(adrMeta.getNamespace());
    }

    @Test
    void throw_an_exception_when_updating_an_adr_that_doesnt_exist() throws JsonProcessingException {
        mockSetupAdrDocumentWithRevisions();

        AdrMeta adrMeta = new AdrMeta.AdrMetaBuilder()
                .setNamespace(NAMESPACE)
                .setId(22)
                .build();

        assertThrows(AdrNotFoundException.class,
                () -> mongoAdrStore.updateAdrForNamespace(adrMeta));
    }

    @Test
    void throw_an_exception_when_updating_an_adr_but_no_revisions_exist() {
        mockSetupAdrDocumentWithNoRevisions();

        AdrMeta adrMeta = new AdrMeta.AdrMetaBuilder()
                .setNamespace(NAMESPACE)
                .setId(42)
                .setAdr(new Adr.AdrBuilder().build())
                .build();

        assertThrows(AdrRevisionNotFoundException.class,
                () -> mongoAdrStore.updateAdrForNamespace(adrMeta));
    }

    @Test
    void throw_an_exception_when_updating_an_adr_but_mongo_cannot_write_update() throws JsonProcessingException {
        mockSetupAdrDocumentWithRevisions();
        when(adrCollection.updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class)))
                .thenThrow(new MongoWriteException(new WriteError(1, "error", new BsonDocument()), new ServerAddress(), List.of()));

        AdrMeta adrMeta = new AdrMeta.AdrMetaBuilder()
                .setNamespace(NAMESPACE)
                .setId(42)
                .setAdr(new Adr.AdrBuilder().build())
                .build();

        assertThrows(AdrPersistenceException.class,
                () -> mongoAdrStore.updateAdrForNamespace(adrMeta));
    }

    @Test
    void return_successfully_when_correctly_updating_an_adr() throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, JsonProcessingException, AdrPersistenceException, AdrParseException {
        mockSetupAdrDocumentWithRevisions();
        AdrMeta adrMeta = new AdrMeta.AdrMetaBuilder()
                .setNamespace(NAMESPACE)
                .setId(42)
                .setRevision(2)
                .setAdr(new Adr.AdrBuilder().build())
                .build();

        mongoAdrStore.updateAdrForNamespace(adrMeta);

        verify(adrCollection, times(1)).updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class));
    }

    @Test
    void throw_an_exception_when_updating_status_with_a_namespace_that_doesnt_exists() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);

        AdrMeta adrMeta = new AdrMeta.AdrMetaBuilder()
                .setNamespace(NAMESPACE)
                .setId(42)
                .build();

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoAdrStore.updateAdrStatus(adrMeta, Status.accepted));

        verify(namespaceStore, times(1)).namespaceExists(adrMeta.getNamespace());
    }

    @Test
    void throw_an_exception_when_updating_the_status_of_an_adr_that_doesnt_exist() throws JsonProcessingException {
        mockSetupAdrDocumentWithRevisions();

        AdrMeta adrMeta = new AdrMeta.AdrMetaBuilder()
                .setNamespace(NAMESPACE)
                .setId(22)
                .build();

        assertThrows(AdrNotFoundException.class,
                () -> mongoAdrStore.updateAdrStatus(adrMeta, Status.accepted));
    }

    @Test
    void throw_an_exception_when_updating_the_status_of_an_adr_but_no_revisions_exist() {
        mockSetupAdrDocumentWithNoRevisions();

        AdrMeta adrMeta = new AdrMeta.AdrMetaBuilder()
                .setNamespace(NAMESPACE)
                .setId(42)
                .build();

        assertThrows(AdrRevisionNotFoundException.class,
                () -> mongoAdrStore.updateAdrStatus(adrMeta, Status.accepted));
    }

    @Test
    void throw_an_exception_when_updating_the_status_of_an_adr_but_mongo_cannot_write_update() throws JsonProcessingException {
        mockSetupAdrDocumentWithRevisions();
        when(adrCollection.updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class)))
                .thenThrow(new MongoWriteException(new WriteError(1, "error", new BsonDocument()), new ServerAddress(), List.of()));

        AdrMeta adrMeta = new AdrMeta.AdrMetaBuilder()
                .setNamespace(NAMESPACE)
                .setId(42)
                .build();

        assertThrows(AdrPersistenceException.class,
                () -> mongoAdrStore.updateAdrStatus(adrMeta, Status.proposed));
    }

    @Test
    void return_successfully_when_correctly_updating_the_status_of_an_adr() throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, JsonProcessingException, AdrPersistenceException, AdrParseException {
        mockSetupAdrDocumentWithRevisions();
        AdrMeta adrMeta = new AdrMeta.AdrMetaBuilder()
                .setNamespace(NAMESPACE)
                .setId(42)
                .build();

        mongoAdrStore.updateAdrStatus(adrMeta, Status.accepted);

        verify(adrCollection, times(1)).updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class));
    }
}
