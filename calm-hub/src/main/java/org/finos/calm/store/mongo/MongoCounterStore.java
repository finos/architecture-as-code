package org.finos.calm.store.mongo;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.FindOneAndUpdateOptions;
import com.mongodb.client.model.ReturnDocument;
import jakarta.enterprise.context.ApplicationScoped;
import org.bson.Document;

@ApplicationScoped
public class MongoCounterStore {

    private final MongoCollection<Document> counterCollection;

    public MongoCounterStore(MongoClient mongoClient) {
        MongoDatabase database = mongoClient.getDatabase("calmSchemas");
        this.counterCollection = database.getCollection("counters");
    }

    public int getNextSequenceValue() {
        return nextValueForCounter("patternStoreCounter");
    }

    public int getNextArchitectureSequenceValue() {
        return nextValueForCounter("architectureStoreCounter");
    }

    private int nextValueForCounter(String counterId) {
        Document filter = new Document("_id", counterId);
        Document update = new Document("$inc", new Document("sequence_value", 1));
        FindOneAndUpdateOptions options = new FindOneAndUpdateOptions().returnDocument(ReturnDocument.AFTER).upsert(true);

        Document result = counterCollection.findOneAndUpdate(filter, update, options);

        return result.getInteger("sequence_value");
    }
}
