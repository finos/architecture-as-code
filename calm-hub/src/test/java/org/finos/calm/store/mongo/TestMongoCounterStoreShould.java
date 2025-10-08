package org.finos.calm.store.mongo;


import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.FindOneAndUpdateOptions;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.when;

@QuarkusTest
public class TestMongoCounterStoreShould {

    @InjectMock
    MongoClient mongoClient;

    private MongoCollection<Document> counterCollection;
    private MongoCounterStore counterStore;

    @BeforeEach
    void setUp() {
        MongoDatabase mongoDatabase = Mockito.mock(MongoDatabase.class);
        counterCollection = Mockito.mock(DocumentMongoCollection.class);

        when(mongoClient.getDatabase("calmSchemas")).thenReturn(mongoDatabase);
        when(mongoDatabase.getCollection("counters")).thenReturn(counterCollection);
        counterStore = new MongoCounterStore(mongoClient);
    }

    private interface DocumentMongoCollection extends MongoCollection<Document> {
    }

    @Test
    void return_the_next_value_in_sequence_for_patterns() {
        Document document = new Document("sequence_value", 42);
        when(counterCollection.findOneAndUpdate(
                argThat(arg -> arg instanceof Document &&
                        ((Document) arg).containsKey("_id") &&
                        "patternStoreCounter".equals(((Document) arg).get("_id"))),
                any(Document.class),
                any(FindOneAndUpdateOptions.class))).thenReturn(document);

        assertThat(counterStore.getNextPatternSequenceValue(), equalTo(42));
    }


    @Test
    void return_the_next_value_in_sequence_for_architectures() {
        Document document = new Document("sequence_value", 10);

        when(counterCollection.findOneAndUpdate(
                argThat(arg -> arg instanceof Document &&
                        ((Document) arg).containsKey("_id") &&
                        "architectureStoreCounter".equals(((Document) arg).get("_id"))),
                any(Document.class),
                any(FindOneAndUpdateOptions.class))).thenReturn(document);

        assertThat(counterStore.getNextArchitectureSequenceValue(), equalTo(10));
    }


    @Test
    void return_the_next_value_in_sequence_for_flows() {
        Document document = new Document("sequence_value", 25);

        when(counterCollection.findOneAndUpdate(
                argThat(arg -> arg instanceof Document &&
                        ((Document) arg).containsKey("_id") &&
                        "flowStoreCounter".equals(((Document) arg).get("_id"))),
                any(Document.class),
                any(FindOneAndUpdateOptions.class)
        )).thenReturn(document);


        assertThat(counterStore.getNextFlowSequenceValue(), equalTo(25));
    }

    @Test
    void return_the_next_value_in_sequence_for_standards() {
        Document document = new Document("sequence_value", 25);

        when(counterCollection.findOneAndUpdate(
                argThat(arg -> arg instanceof Document &&
                        ((Document) arg).containsKey("_id") &&
                        "standardStoreCounter".equals(((Document) arg).get("_id"))),
                any(Document.class),
                any(FindOneAndUpdateOptions.class)
        )).thenReturn(document);


        assertThat(counterStore.getNextStandardSequenceValue(), equalTo(25));
    }

    @Test
    void return_the_next_value_in_sequence_for_user_access_collection() {
        Document document = new Document("sequence_value", 3);

        when(counterCollection.findOneAndUpdate(
                argThat(arg -> arg instanceof Document &&
                        ((Document) arg).containsKey("_id") &&
                        "userAccessStoreCounter".equals(((Document) arg).get("_id"))),
                any(Document.class),
                any(FindOneAndUpdateOptions.class)
        )).thenReturn(document);

        assertThat(counterStore.getNextUserAccessSequenceValue(), equalTo(3));
    }
}
