package org.finos.calm.store.mongo;

import com.mongodb.MongoWriteException;
import com.mongodb.ServerAddress;
import com.mongodb.WriteError;
import com.mongodb.client.*;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.bson.BsonDocument;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.finos.calm.domain.exception.DomainAlreadyExistsException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.Arrays;
import java.util.List;

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
    MongoDatabase mongoDatabase;

    private MongoCollection<Document> domainsCollection;
    private MongoDomainStore mongoDomainStore;

    @BeforeEach
    public void setup() {
        domainsCollection = Mockito.mock(DocumentMongoCollection.class);

        when(mongoDatabase.getCollection("domains")).thenReturn(domainsCollection);
        mongoDomainStore = new MongoDomainStore(mongoDatabase);
    }

    @Test
    void get_domains_returns_domains_in_collection() {
        FindIterable<Document> findIterable = Mockito.mock(DocumentFindIterable.class);
        MongoCursor<Document> cursor = Mockito.mock(DocumentMongoCursor.class);

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
        WriteError writeError = new WriteError(11000, "duplicate key error", new BsonDocument());
        MongoWriteException duplicateKeyException = new MongoWriteException(writeError, new ServerAddress());
        Mockito.doThrow(duplicateKeyException).when(domainsCollection).insertOne(any(Document.class));

        assertThrows(DomainAlreadyExistsException.class, () -> mongoDomainStore.createDomain("security"));
    }

    @Test
    void create_domain_succeeds_if_domain_doesnt_exist() throws DomainAlreadyExistsException {
        mongoDomainStore.createDomain("security");
        verify(domainsCollection).insertOne(new Document("name", "security"));
    }

    @Test
    void get_domains_returns_an_empty_array_when_collection_is_empty() {
        //TODO Refactor across these iterables once other PRs in mongo work are in
        FindIterable<Document> findIterable = emptyFindIterableSetup();
        when(domainsCollection.find()).thenReturn(findIterable);

        List<String> domains = mongoDomainStore.getDomains();

        assertThat(domains, is(empty()));
    }

    private FindIterable<Document> emptyFindIterableSetup() {
        FindIterable<Document> findIterable = Mockito.mock(DocumentFindIterable.class);
        MongoCursor<Document> emptyCursor = Mockito.mock(DocumentMongoCursor.class);

        when(emptyCursor.hasNext()).thenReturn(false);
        when(findIterable.iterator()).thenReturn(emptyCursor);
        return findIterable;
    }


    private interface DocumentFindIterable extends FindIterable<Document> {
    }

    private interface DocumentMongoCollection extends MongoCollection<Document> {
    }

    private interface DocumentMongoCursor extends MongoCursor<Document> {
    }
}
