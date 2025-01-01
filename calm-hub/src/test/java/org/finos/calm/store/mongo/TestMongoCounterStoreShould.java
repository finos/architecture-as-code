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
import static org.mockito.Mockito.when;

@QuarkusTest
public class TestMongoCounterStoreShould {

    @InjectMock
    MongoClient mongoClient;

    private MongoDatabase mongoDatabase;
    private MongoCollection<Document> counterCollection;
    private MongoCounterStore counterStore;

    @BeforeEach
    void setUp() {
        mongoDatabase = Mockito.mock(MongoDatabase.class);
        counterCollection = Mockito.mock(MongoCollection.class);

        when(mongoClient.getDatabase("calmSchemas")).thenReturn(mongoDatabase);
        when(mongoDatabase.getCollection("counters")).thenReturn(counterCollection);
        counterStore = new MongoCounterStore(mongoClient);
    }

    @Test
    void return_the_next_value_in_sequence() {
        Document document = new Document("sequence_value", 42);
        when(counterCollection.findOneAndUpdate(any(Document.class), any(Document.class),
                any(FindOneAndUpdateOptions.class))).thenReturn(document);

        assertThat(counterStore.getNextSequenceValue(), equalTo(42));
    }
}
