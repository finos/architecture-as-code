package org.finos.calm.store.mongo;

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
import org.bson.json.JsonParseException;
import org.finos.calm.domain.Adr;
import org.finos.calm.domain.AdrBuilder;
import org.finos.calm.domain.Architecture;
import org.finos.calm.domain.exception.AdrNotFoundException;
import org.finos.calm.domain.exception.AdrRevisionNotFoundException;
import org.finos.calm.domain.exception.ArchitectureVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
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

    private MongoDatabase mongoDatabase;
    private MongoCollection<Document> adrCollection;
    private MongoAdrStore mongoAdrStore;
    private final String NAMESPACE = "finos";

    private final String validJson = "{\"test\": \"test\"}";

    @BeforeEach
    void setup() {
        mongoDatabase = Mockito.mock(MongoDatabase.class);
        adrCollection = Mockito.mock(MongoCollection.class);

        when(mongoClient.getDatabase("calmSchemas")).thenReturn(mongoDatabase);
        when(mongoDatabase.getCollection("adrs")).thenReturn(adrCollection);
        mongoAdrStore = new MongoAdrStore(mongoClient, counterStore, namespaceStore);
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

        List<Integer> architectureIds = mongoAdrStore.getAdrsForNamespace(NAMESPACE);

        assertThat(architectureIds, is(Arrays.asList(1001, 1002)));
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
    void return_a_json_parse_exception_when_an_invalid_json_object_is_presented_when_creating_an_adr() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(counterStore.getNextArchitectureSequenceValue()).thenReturn(42);
        Adr adr = AdrBuilder.builder().namespace(NAMESPACE)
                .adr("Invalid JSON")
                .build();

        assertThrows(JsonParseException.class,
                () -> mongoAdrStore.createAdrForNamespace(adr));
    }

    @Test
    void return_created_adr_when_parameters_are_valid() throws NamespaceNotFoundException {
        String validNamespace = NAMESPACE;
        int sequenceNumber = 42;
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(counterStore.getNextAdrSequenceValue()).thenReturn(sequenceNumber);
        Adr adrToCreate = AdrBuilder.builder().adr(validJson)
                .namespace(validNamespace)
                .revision(1)
                .build();

        Adr adr = mongoAdrStore.createAdrForNamespace(adrToCreate);

        Adr expectedAdr = AdrBuilder.builder().adr(validJson)
                .namespace(validNamespace)
                .revision(1)
                .id(sequenceNumber)
                .build();

        assertThat(adr, is(expectedAdr));
        Document expectedDoc = new Document("adrId", adr.id()).append("revisions",
                new Document("1", Document.parse(adr.adr())));

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
    void get_adr_revisions_for_valid_adr_returns_list_of_revisions() throws NamespaceNotFoundException, AdrNotFoundException {
        mockSetupAdrDocumentWithRevisions();

        Adr adr = AdrBuilder.builder().namespace(NAMESPACE).id(42).build();
        List<Integer> adrRevisions = mongoAdrStore.getAdrRevisions(adr);

        assertThat(adrRevisions, is(List.of(1)));
    }

    @Test
    void throw_an_exception_for_an_invalid_adre_when_retrieving_adr_revision() {
        FindIterable<Document> findIterable = setupInvalidAdr();
        Adr adr = AdrBuilder.builder().namespace(NAMESPACE).build();

        assertThrows(AdrNotFoundException.class,
                () -> mongoAdrStore.getAdrRevision(adr));

        verify(adrCollection).find(new Document("namespace", adr.namespace()));
        verify(findIterable).projection(Projections.fields(Projections.include("adrs")));
    }

    @Test
    void return_an_adr_revision() throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException {
        mockSetupAdrDocumentWithRevisions();

        Adr adr = AdrBuilder.builder().namespace(NAMESPACE)
                .id(42).revision(1).build();

        String adrRevision = mongoAdrStore.getAdrRevision(adr);
        assertThat(adrRevision, is(validJson));
    }

    private void mockSetupAdrDocumentWithRevisions() {
        Document mainDocument = setupAdrRevisionDocument();
        FindIterable<Document> findIterable = Mockito.mock(FindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(adrCollection.find(any(Bson.class)))
                .thenReturn(findIterable);
        when(findIterable.projection(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(mainDocument);
    }

    private Document setupAdrRevisionDocument() {
        //Set up an ADR document with 2 ADRs in (one with a valid revision)
        Map<String, Document> revisionMap = new HashMap<>();
        revisionMap.put("1", Document.parse(validJson));
        Document targetStoredAdr = new Document("adrId", 42)
                .append("revisions", new Document(revisionMap));

        Document paddingAdr = new Document("adrId", 0);

        return new Document("namespace", NAMESPACE)
                .append("adrs", Arrays.asList(paddingAdr, targetStoredAdr));
    }

    @Test
    void throw_an_exception_when_revision_of_adr_does_not_exist()  {
        mockSetupAdrDocumentWithRevisions();

        Adr adr = AdrBuilder.builder().namespace(NAMESPACE)
                .id(42).revision(9).build();

        assertThrows(AdrRevisionNotFoundException.class,
                () -> mongoAdrStore.getAdrRevision(adr));
    }
}
