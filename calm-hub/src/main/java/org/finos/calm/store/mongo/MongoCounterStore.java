package org.finos.calm.store.mongo;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.FindOneAndUpdateOptions;
import com.mongodb.client.model.ReturnDocument;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import org.bson.Document;

/**
 * Provides atomically-incrementing sequence counters for generating unique integer IDs
 * across all entity types (architectures, patterns, flows, controls, etc.).
 *
 * <h2>How it works</h2>
 * Each entity type has a dedicated counter document in the {@code counters} collection,
 * identified by its {@code _id} (e.g. {@code "architectureStoreCounter"}). The
 * {@link #nextValueForCounter} method uses MongoDB's atomic
 * {@code findOneAndUpdate} with {@code $inc} to increment the counter and return
 * the new value in a single round-trip. Because this is a single atomic operation,
 * no two callers can ever receive the same sequence number — even under high concurrency.
 *
 * <h2>Why no unique index is needed</h2>
 * Unlike the entity collections, the counters collection does not need a unique index
 * because MongoDB's {@code findOneAndUpdate} is inherently atomic. The {@code upsert: true}
 * option ensures the counter document is created automatically on first use.
 *
 * <h2>Failure behaviour</h2>
 * If MongoDB is unavailable, the {@code findOneAndUpdate} call will throw a
 * {@link com.mongodb.MongoException}, preventing any entity from being created with
 * an invalid or duplicate ID.
 */
@ApplicationScoped
@Typed(MongoCounterStore.class)
public class MongoCounterStore {

    private final MongoCollection<Document> counterCollection;

    public MongoCounterStore(MongoDatabase database) {
        this.counterCollection = database.getCollection("counters");
    }

    public int getNextPatternSequenceValue() {
        return nextValueForCounter("patternStoreCounter");
    }

    public int getNextArchitectureSequenceValue() {
        return nextValueForCounter("architectureStoreCounter");
    }


    public int getNextAdrSequenceValue() {
        return nextValueForCounter("adrStoreCounter");
    }

    public int getNextFlowSequenceValue() {
        return nextValueForCounter("flowStoreCounter");
    }

    public int getNextStandardSequenceValue() {
        return nextValueForCounter("standardStoreCounter");
    }

    public int getNextUserAccessSequenceValue() {
        return nextValueForCounter("userAccessStoreCounter");
    }

    public int getNextDecoratorSequenceValue() {
        return nextValueForCounter("decoratorStoreCounter");
    }
  
    public int getNextControlSequenceValue() {
        return nextValueForCounter("controlStoreCounter");
    }

    public int getNextControlConfigurationSequenceValue() {
        return nextValueForCounter("controlConfigurationStoreCounter");
    }

    public int getNextInterfaceSequenceValue() {
        return nextValueForCounter("interfaceStoreCounter");
    }

    /**
     * Atomically increments and returns the next sequence value for the given counter.
     * Uses {@code findOneAndUpdate} with {@code $inc} — a single atomic MongoDB operation
     * that guarantees no two callers receive the same value. The {@code upsert: true}
     * option creates the counter document on first use (starting at 1).
     *
     * @param counterId the {@code _id} of the counter document (e.g. "architectureStoreCounter")
     * @return the next integer sequence value
     */
    private int nextValueForCounter(String counterId) {
        Document filter = new Document("_id", counterId);
        Document update = new Document("$inc", new Document("sequence_value", 1));
        FindOneAndUpdateOptions options = new FindOneAndUpdateOptions().returnDocument(ReturnDocument.AFTER).upsert(true);

        Document result = counterCollection.findOneAndUpdate(filter, update, options);

        return result.getInteger("sequence_value");
    }
}
