package org.finos.calm.store.mongo;

import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.UpdateOptions;
import com.mongodb.client.result.UpdateResult;
import org.bson.BsonDocument;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.finos.calm.domain.Decorator;
import org.finos.calm.domain.DecoratorHistoryEntry;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doCallRealMethod;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestMongoDecoratorTimestampsShould {

    private static final String UTC_MILLIS = "\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z";
    private static final String CREATED = "2026-11-01T09:00:00.000Z";
    private static final String UPDATED = "2026-11-02T10:30:00.000Z";
    private static final String SUPERSEDED = "2026-11-03T11:45:00.000Z";

    @Mock
    private MongoDatabase database;

    @Mock
    private MongoCollection<Document> decoratorCollection;

    @Mock
    private MongoNamespaceStore namespaceStore;

    @Mock
    private MongoCounterStore counterStore;

    @Mock
    private FindIterable<Document> findIterable;

    private MongoDecoratorStore decoratorStore;

    @BeforeEach
    void setUp() throws NamespaceNotFoundException {
        doCallRealMethod().when(namespaceStore).requireNamespace(anyString());
        when(database.getCollection("decorators")).thenReturn(decoratorCollection);
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);
        decoratorStore = new MongoDecoratorStore(database, namespaceStore, counterStore);
    }

    @Test
    void record_both_times_beside_the_decorator_when_creating() throws Exception {
        when(counterStore.getNextDecoratorSequenceValue()).thenReturn(1);
        ArgumentCaptor<Bson> update = ArgumentCaptor.forClass(Bson.class);

        decoratorStore.createDecorator("finos", "{\"unique-id\": \"d1\", \"type\": \"deployment\"}");

        verify(decoratorCollection).updateOne(any(Bson.class), update.capture(), any(UpdateOptions.class));
        BsonDocument entry = update.getValue().toBsonDocument().getDocument("$push").getDocument("decorators");
        String created = entry.getString("creationDateTime").getValue();
        assertTrue(created.matches(UTC_MILLIS), created);
        assertEquals(created, entry.getString("updateDateTime").getValue());
        assertFalse(entry.getDocument("decorator").containsKey("creationDateTime"));
    }

    @Test
    void set_only_the_update_time_when_updating_in_place() throws Exception {
        UpdateResult updateResult = mock(UpdateResult.class);
        when(updateResult.getMatchedCount()).thenReturn(1L);
        ArgumentCaptor<Bson> update = ArgumentCaptor.forClass(Bson.class);
        when(decoratorCollection.updateOne(any(Bson.class), update.capture())).thenReturn(updateResult);

        decoratorStore.updateDecorator("finos", 1, "{\"unique-id\": \"d1\", \"type\": \"deployment\"}");

        BsonDocument set = update.getValue().toBsonDocument().getDocument("$set");
        assertTrue(set.getString("decorators.$.updateDateTime").getValue().matches(UTC_MILLIS));
        assertFalse(set.containsKey("decorators.$.creationDateTime"));
        assertFalse(set.getDocument("decorators.$.decorator").containsKey("updateDateTime"));
    }

    @Test
    void record_the_supersession_time_on_the_old_entry_and_new_times_on_the_successor() throws Exception {
        when(decoratorCollection.countDocuments(any(Bson.class))).thenReturn(1L);
        when(counterStore.getNextDecoratorSequenceValue()).thenReturn(2);
        UpdateResult updateResult = mock(UpdateResult.class);
        when(updateResult.getModifiedCount()).thenReturn(1L);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<? extends Bson>> pipeline = ArgumentCaptor.forClass(List.class);
        when(decoratorCollection.updateOne(any(Bson.class), pipeline.capture())).thenReturn(updateResult);

        decoratorStore.supersedeDecorator("finos", 1, "{\"type\": \"control-evaluation\"}");

        var arrays = pipeline.getValue().getFirst().toBsonDocument()
                .getDocument("$set").getDocument("decorators").getArray("$concatArrays");
        BsonDocument successor = arrays.get(1).asDocument().getArray("$literal").getFirst().asDocument();
        BsonDocument marked = arrays.getFirst().asDocument().getDocument("$map").getDocument("in")
                .getArray("$cond").get(1).asDocument().getArray("$mergeObjects").get(1).asDocument();
        String superseded = marked.getString("supersededDateTime").getValue();
        assertTrue(superseded.matches(UTC_MILLIS), superseded);
        assertEquals(superseded, successor.getString("creationDateTime").getValue());
        assertEquals(superseded, successor.getString("updateDateTime").getValue());
        assertFalse(marked.containsKey("updateDateTime"));
    }

    @Test
    void return_the_stored_times_on_every_read() throws Exception {
        Document old = entry(1, "eval-1").append("supersededBy", 2).append("supersededDateTime", SUPERSEDED);
        Document current = entry(2, "eval-2").append("supersedes", 1);
        mockNamespaceDocument(old, current);

        Decorator byId = decoratorStore.getDecoratorById("finos", 2).orElseThrow();
        assertEquals(CREATED, byId.getCreationDateTime());
        assertEquals(UPDATED, byId.getUpdateDateTime());
        assertEquals(List.of(byId), decoratorStore.getDecoratorValuesForNamespace("finos", null, null));

        List<DecoratorHistoryEntry> history = decoratorStore.getDecoratorHistory("finos", 2);
        assertNull(history.get(0).getSupersededDateTime());
        assertEquals(SUPERSEDED, history.get(1).getSupersededDateTime());
        assertEquals(CREATED, history.get(1).getDecorator().getCreationDateTime());
        assertEquals(UPDATED, history.get(1).getDecorator().getUpdateDateTime());
    }

    @Test
    void return_no_times_for_a_decorator_stored_before_hub_recorded_them() throws Exception {
        mockNamespaceDocument(new Document("decoratorId", 1)
                .append("decorator", new Document("unique-id", "legacy").append("type", "deployment")));

        Decorator decorator = decoratorStore.getDecoratorById("finos", 1).orElseThrow();

        assertNull(decorator.getCreationDateTime());
        assertNull(decorator.getUpdateDateTime());
        assertNull(decoratorStore.getDecoratorHistory("finos", 1).getFirst().getSupersededDateTime());
    }

    private void mockNamespaceDocument(Document... decorators) {
        when(decoratorCollection.find(any(Bson.class))).thenReturn(findIterable);
        lenient().when(findIterable.projection(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(new Document("namespace", "finos").append("decorators", List.of(decorators)));
    }

    private static Document entry(int id, String uniqueId) {
        return new Document("decoratorId", id)
                .append("decorator", new Document("unique-id", uniqueId).append("type", "control-evaluation"))
                .append("creationDateTime", CREATED)
                .append("updateDateTime", UPDATED);
    }
}
