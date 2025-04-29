package org.finos.calm.store.mongo;

import com.mongodb.client.*;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.finos.calm.domain.exception.DomainAlreadyExistsException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.*;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@QuarkusTest
public class TestMongoDomainStoreShould {
    @InjectMock
    MongoClient mongoClient;

    private MongoDatabase mongoDatabase;
    private MongoCollection<Document> domainsCollection;

    private MongoDomainStore mongoDomainStore;

    @BeforeEach
    public void setup() {
        mongoDatabase = Mockito.mock(MongoDatabase.class);
        domainsCollection = Mockito.mock(MongoCollection.class);

        when(mongoClient.getDatabase("calmSchemas")).thenReturn(mongoDatabase);
        when(mongoDatabase.getCollection("domains")).thenReturn(domainsCollection);
        mongoDomainStore = new MongoDomainStore(mongoClient);
    }

    @Test
    void get_domains_returns_an_empty_array_when_collection_is_empty() {
        FindIterable<Document> findIterable = emptyFindIterableSetup();
        when(domainsCollection.find()).thenReturn(findIterable);

        List<String> domains = mongoDomainStore.getDomains();

        assertThat(domains, is(empty()));
    }

    @Test
    void get_domains_returns_domains_in_collection() {
        FindIterable<Document> findIterable = Mockito.mock(FindIterable.class);
        MongoCursor<Document> cursor = Mockito.mock(MongoCursor.class);

        when(cursor.hasNext()).thenReturn(true, true, false);
        when(cursor.next()).thenReturn(new Document("name", "security"))
                .thenReturn(new Document("name", "observability"));
        when(findIterable.iterator()).thenReturn(cursor);
        when(domainsCollection.find()).thenReturn(findIterable);

        List<String> domains = mongoDomainStore.getDomains();

        List<String> expectedDomains = Arrays.asList("security", "observability");
        assertThat(domains, is(expectedDomains));
    }


    @Test
    void create_domain_fails_and_throws_if_domain_already_exists() {
        //Simulate a domain already existing
        FindIterable<Document> findIterable = Mockito.mock(FindIterable.class);
        when(domainsCollection.find(any(Bson.class))).thenReturn(findIterable);
        Document documentMock = Mockito.mock(Document.class);
        when(findIterable.first()).thenReturn(documentMock);

        assertThrows(DomainAlreadyExistsException.class, () -> mongoDomainStore.createDomain("security"));
    }

    @Test
    void create_domain_succeeds_if_domain_doesnt_exist() throws DomainAlreadyExistsException {
        FindIterable<Document> findIterable = Mockito.mock(FindIterable.class);
        when(domainsCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(null);

        mongoDomainStore.createDomain("security");
        verify(domainsCollection).insertOne(new Document("name", "security"));
    }

    private FindIterable<Document> emptyFindIterableSetup() {
        FindIterable<Document> findIterable = Mockito.mock(FindIterable.class);
        MongoCursor<Document> emptyCursor = Mockito.mock(MongoCursor.class);

        when(emptyCursor.hasNext()).thenReturn(false);
        when(findIterable.iterator()).thenReturn(emptyCursor);
        return findIterable;
    }
}
