package org.finos.calm.store.mongo;

import com.mongodb.MongoWriteException;
import com.mongodb.ServerAddress;
import com.mongodb.WriteError;
import com.mongodb.client.AggregateIterable;
import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.result.DeleteResult;
import com.mongodb.client.result.InsertOneResult;
import com.mongodb.client.result.UpdateResult;
import org.bson.BsonBinaryWriter;
import org.bson.BsonDocument;
import org.bson.BsonMaximumSizeExceededException;
import org.bson.BsonSerializationException;
import org.bson.Document;
import org.bson.codecs.DocumentCodec;
import org.bson.codecs.EncoderContext;
import org.bson.conversions.Bson;
import org.bson.io.BasicOutputBuffer;
import org.bson.json.JsonParseException;
import org.bson.types.Decimal128;
import org.finos.calm.domain.Decorator;
import org.finos.calm.domain.DecoratorHistoryEntry;
import org.finos.calm.domain.exception.DecoratorKeyRefusedException;
import org.finos.calm.domain.exception.DecoratorNotFoundException;
import org.finos.calm.domain.exception.DecoratorSupersededException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.StorageWriteException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doCallRealMethod;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TestMongoDecoratorStoreShould {

    private interface DocumentMongoCollection extends MongoCollection<Document> {
    }

    private interface DocumentFindIterable extends FindIterable<Document> {
    }

    private interface DocumentAggregateIterable extends AggregateIterable<Document> {
    }

    private static final String NAMESPACE = "finos";
    private static final String TARGET = "/calm/namespaces/finos/architectures/1/versions/1-0-0";
    private static final Bson NOT_SUPERSEDED = Filters.exists("supersededBy", false);

    private MongoCollection<Document> decoratorCollection;
    private MongoNamespaceStore namespaceStore;
    private MongoCounterStore counterStore;
    private MongoDecoratorStore decoratorStore;

    @BeforeEach
    void setup() throws NamespaceNotFoundException {
        MongoDatabase database = mock(MongoDatabase.class);
        decoratorCollection = mock(DocumentMongoCollection.class);
        namespaceStore = mock(MongoNamespaceStore.class);
        counterStore = mock(MongoCounterStore.class);
        when(database.getCollection("decorators")).thenReturn(decoratorCollection);
        doCallRealMethod().when(namespaceStore).requireNamespace(anyString());
        when(namespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);
        when(decoratorCollection.updateOne(any(Bson.class), any(Bson.class))).thenReturn(matched(1));
        when(decoratorCollection.deleteOne(any(Bson.class))).thenReturn(DeleteResult.acknowledged(1));
        when(decoratorCollection.deleteMany(any(Bson.class))).thenReturn(DeleteResult.acknowledged(1));
        when(decoratorCollection.insertOne(any(Document.class))).thenReturn(mock(InsertOneResult.class));

        decoratorStore = new MongoDecoratorStore(database, namespaceStore, counterStore);
    }

    private static Document decorator(String uniqueId, String type) {
        return new Document("unique-id", uniqueId).append("type", type).append("target", List.of(TARGET));
    }

    private static Document stored(int id, Document decorator) {
        return MongoDecoratorStore.toStoredDocument(NAMESPACE, id, decorator);
    }

    private static UpdateResult matched(long count) {
        return UpdateResult.acknowledged(count, count, null);
    }

    /** Returns the find filter captor. */
    private ArgumentCaptor<Bson> stubFind(List<Document> results) {
        FindIterable<Document> iterable = mock(DocumentFindIterable.class);
        ArgumentCaptor<Bson> filter = ArgumentCaptor.forClass(Bson.class);
        when(decoratorCollection.find(filter.capture())).thenReturn(iterable);
        when(iterable.projection(any())).thenReturn(iterable);
        when(iterable.sort(any())).thenReturn(iterable);
        when(iterable.first()).thenReturn(results.isEmpty() ? null : results.getFirst());
        doAnswer(invocation -> {
            Collection<Document> target = invocation.getArgument(0);
            target.addAll(results);
            return target;
        }).when(iterable).into(any());
        return filter;
    }

    /** Stubs the $graphLookup result: the matched decorator with the ones after and before it. */
    private void stubHistory(Document match, List<Document> newer, List<Document> older) {
        AggregateIterable<Document> iterable = mock(DocumentAggregateIterable.class);
        when(decoratorCollection.aggregate(anyList())).thenReturn(iterable);
        when(iterable.first()).thenReturn(match == null ? null
                : new Document(match).append("newer", newer).append("older", older));
    }

    private static Document current(int id, Integer supersedes) {
        Document doc = stored(id, decorator("eval-" + id, "control-evaluation"));
        return supersedes == null ? doc : doc.append("supersedes", supersedes);
    }

    private static Document superseded(int id, int supersededBy) {
        return current(id, null).append("supersededBy", supersededBy);
    }

    private static BsonDocument bson(Bson filter) {
        return filter.toBsonDocument();
    }

    private static BsonDocument insertedDecorator(MongoCollection<Document> collection) {
        ArgumentCaptor<Document> inserted = ArgumentCaptor.forClass(Document.class);
        verify(collection).insertOne(inserted.capture());
        return inserted.getValue().toBsonDocument().getDocument("decorator");
    }

    @Test
    void copy_type_and_target_to_the_top_level_of_the_stored_document() {
        Document decorator = decorator("d-1", "deployment");

        Document stored = MongoDecoratorStore.toStoredDocument(NAMESPACE, 7, decorator);

        assertThat(stored.getString("namespace"), is(NAMESPACE));
        assertThat(stored.getInteger("decoratorId"), is(7));
        assertThat(stored.getString("type"), is("deployment"));
        assertThat(stored.get("target"), is(List.of(TARGET)));
        assertThat(stored.get("decorator"), is(decorator));
    }

    @Test
    void not_copy_a_type_or_target_with_the_wrong_field_type() {
        Document stored = MongoDecoratorStore.toStoredDocument(NAMESPACE, 7, new Document("type", 5).append("target", "t"));

        assertFalse(stored.containsKey("type"));
        assertFalse(stored.containsKey("target"));
    }

    @Test
    void query_only_current_decorators_of_the_namespace_when_no_filters_are_given() throws NamespaceNotFoundException {
        ArgumentCaptor<Bson> filter = stubFind(List.of(
                stored(1, decorator("d-1", "deployment")),
                stored(2, decorator("d-2", "observability"))));

        List<Integer> ids = decoratorStore.getDecoratorsForNamespace(NAMESPACE, null, "");

        assertThat(ids, contains(1, 2));
        assertThat(bson(filter.getValue()), is(bson(Filters.and(List.of(
                Filters.eq("namespace", NAMESPACE), NOT_SUPERSEDED)))));
    }

    @Test
    void push_target_and_type_filters_into_the_query() throws NamespaceNotFoundException {
        ArgumentCaptor<Bson> filter = stubFind(List.of(stored(1, decorator("d-1", "deployment"))));

        List<Integer> ids = decoratorStore.getDecoratorsForNamespace(NAMESPACE, TARGET, "deployment");

        assertThat(ids, contains(1));
        assertThat(bson(filter.getValue()), is(bson(Filters.and(List.of(
                Filters.eq("namespace", NAMESPACE),
                Filters.eq("target", TARGET),
                Filters.eq("type", "deployment"),
                NOT_SUPERSEDED)))));
    }

    @Test
    void ignore_a_blank_target_filter() throws NamespaceNotFoundException {
        ArgumentCaptor<Bson> filter = stubFind(List.of());

        decoratorStore.getDecoratorValuesForNamespace(NAMESPACE, " ", null);

        assertThat(bson(filter.getValue()), is(bson(Filters.and(List.of(
                Filters.eq("namespace", NAMESPACE), NOT_SUPERSEDED)))));
    }

    @Test
    void return_decorator_values_and_skip_documents_without_content() throws NamespaceNotFoundException {
        stubFind(List.of(
                stored(1, decorator("d-1", "deployment")),
                new Document("namespace", NAMESPACE).append("decoratorId", 2)));

        List<Decorator> values = decoratorStore.getDecoratorValuesForNamespace(NAMESPACE, TARGET, null);

        assertThat(values.size(), is(1));
        assertThat(values.getFirst().getUniqueId(), is("d-1"));
        assertThat(values.getFirst().getType(), is("deployment"));
    }

    @Test
    void return_an_empty_list_when_no_decorators_match() throws NamespaceNotFoundException {
        stubFind(List.of());

        assertThat(decoratorStore.getDecoratorsForNamespace(NAMESPACE, TARGET, null), is(empty()));
        assertThat(decoratorStore.getDecoratorValuesForNamespace(NAMESPACE, TARGET, null), is(empty()));
    }

    @Test
    void get_a_decorator_by_namespace_and_id_superseded_or_not() throws NamespaceNotFoundException {
        ArgumentCaptor<Bson> filter = stubFind(List.of(stored(3, decorator("d-3", "deployment")).append("supersededBy", 4)));

        Optional<Decorator> result = decoratorStore.getDecoratorById(NAMESPACE, 3);

        assertThat(result.isPresent(), is(true));
        assertThat(result.get().getUniqueId(), is("d-3"));
        assertThat(bson(filter.getValue()), is(bson(Filters.and(
                Filters.eq("namespace", NAMESPACE), Filters.eq("decoratorId", 3)))));
    }

    @Test
    void return_empty_when_the_decorator_id_does_not_exist() throws NamespaceNotFoundException {
        stubFind(List.of());

        assertThat(decoratorStore.getDecoratorById(NAMESPACE, 99).isPresent(), is(false));
    }

    @Test
    void return_empty_when_the_stored_document_has_no_content() throws NamespaceNotFoundException {
        stubFind(List.of(new Document("namespace", NAMESPACE).append("decoratorId", 3)));

        assertThat(decoratorStore.getDecoratorById(NAMESPACE, 3).isPresent(), is(false));
    }

    @Test
    void decode_a_decorator_stored_with_wrong_field_types() throws NamespaceNotFoundException {
        stubFind(List.of(stored(1, new Document("type", 5).append("target", "t").append("applies-to", List.of("a", 2))
                .append("target-type", List.of("architecture")).append("unique-id", 7))));

        Decorator decorator = decoratorStore.getDecoratorById(NAMESPACE, 1).orElseThrow();

        assertNull(decorator.getType());
        assertNull(decorator.getTarget());
        assertNull(decorator.getAppliesTo());
        assertNull(decorator.getUniqueId());
        assertEquals(List.of("architecture"), decorator.getTargetType());
    }

    @Test
    void read_decimal128_data_as_jdk_numbers() throws NamespaceNotFoundException {
        stubFind(List.of(stored(1, new Document("type", "deployment")
                .append("data", new Document("big", Decimal128.parse("123456789012345678901234567890"))
                        .append("exponent", Decimal128.parse("1E+3"))
                        .append("decimal", Decimal128.parse("1.50"))
                        .append("negativeZero", Decimal128.NEGATIVE_ZERO)
                        .append("nan", Decimal128.NaN)
                        .append("small", 3)
                        .append("nested", new Document("n", Decimal128.parse("7")))
                        .append("list", List.of(Decimal128.parse("8"), "text"))))));

        Map<?, ?> data = (Map<?, ?>) decoratorStore.getDecoratorById(NAMESPACE, 1).orElseThrow().getData();

        assertEquals(new BigInteger("123456789012345678901234567890"), data.get("big"));
        assertEquals(BigInteger.valueOf(1000), data.get("exponent"));
        assertEquals(new BigDecimal("1.50"), data.get("decimal"));
        assertEquals(BigDecimal.ZERO, data.get("negativeZero"));
        assertEquals(Decimal128.NaN, data.get("nan"));
        assertEquals(3, data.get("small"));
        assertEquals(BigInteger.valueOf(7), ((Map<?, ?>) data.get("nested")).get("n"));
        assertEquals(List.of(BigInteger.valueOf(8), "text"), data.get("list"));
    }

    @Test
    void read_a_decorator_with_no_data() throws NamespaceNotFoundException {
        stubFind(List.of(stored(1, new Document("type", "deployment"))));

        assertNull(decoratorStore.getDecoratorById(NAMESPACE, 1).orElseThrow().getData());
    }

    @Test
    void insert_one_document_when_creating_a_decorator() throws NamespaceNotFoundException {
        when(counterStore.getNextDecoratorSequenceValue()).thenReturn(5);
        ArgumentCaptor<Document> inserted = ArgumentCaptor.forClass(Document.class);

        int id = decoratorStore.createDecorator(NAMESPACE,
                "{\"unique-id\": \"d-5\", \"type\": \"deployment\", \"target\": [\"" + TARGET + "\"]}");

        assertThat(id, is(5));
        verify(decoratorCollection).insertOne(inserted.capture());
        assertThat(inserted.getValue().getString("namespace"), is(NAMESPACE));
        assertThat(inserted.getValue().getInteger("decoratorId"), is(5));
        assertThat(inserted.getValue().getString("type"), is("deployment"));
        assertThat(inserted.getValue().get("target"), is(List.of(TARGET)));
    }

    @Test
    void update_the_current_decorator_and_its_indexed_fields() throws Exception {
        ArgumentCaptor<Bson> filter = ArgumentCaptor.forClass(Bson.class);
        ArgumentCaptor<Bson> update = ArgumentCaptor.forClass(Bson.class);
        when(decoratorCollection.updateOne(filter.capture(), update.capture())).thenReturn(matched(1));

        decoratorStore.updateDecorator(NAMESPACE, 1, "{\"unique-id\": \"d-1\", \"type\": \"observability\"}");

        assertThat(bson(filter.getValue()), is(bson(Filters.and(Filters.and(
                Filters.eq("namespace", NAMESPACE), Filters.eq("decoratorId", 1)), NOT_SUPERSEDED))));
        BsonDocument updateDoc = bson(update.getValue());
        assertEquals("observability", updateDoc.getDocument("$set").getString("type").getValue());
        assertEquals("observability", updateDoc.getDocument("$set").getDocument("decorator").getString("type").getValue());
        assertTrue(updateDoc.getDocument("$unset").containsKey("target"));
    }

    @Test
    void update_a_decorator_that_matched_even_if_nothing_changed() {
        when(decoratorCollection.updateOne(any(Bson.class), any(Bson.class)))
                .thenReturn(UpdateResult.acknowledged(1, 0L, null));

        assertDoesNotThrow(() -> decoratorStore.updateDecorator(NAMESPACE, 1, "{\"type\": \"deployment\"}"));
    }

    @Test
    void throw_not_found_when_updating_a_decorator_that_does_not_exist() {
        when(decoratorCollection.updateOne(any(Bson.class), any(Bson.class))).thenReturn(matched(0));
        when(decoratorCollection.countDocuments(any(Bson.class))).thenReturn(0L);

        assertThrows(DecoratorNotFoundException.class,
                () -> decoratorStore.updateDecorator(NAMESPACE, 1, "{\"type\": \"deployment\"}"));
    }

    @Test
    void throw_superseded_when_updating_a_superseded_decorator() {
        when(decoratorCollection.updateOne(any(Bson.class), any(Bson.class))).thenReturn(matched(0));
        when(decoratorCollection.countDocuments(any(Bson.class))).thenReturn(1L);

        assertThrows(DecoratorSupersededException.class,
                () -> decoratorStore.updateDecorator(NAMESPACE, 1, "{\"type\": \"deployment\"}"));
    }

    @Test
    void mark_the_old_decorator_before_it_inserts_the_successor() throws Exception {
        when(decoratorCollection.countDocuments(any(Bson.class))).thenReturn(1L);
        when(counterStore.getNextDecoratorSequenceValue()).thenReturn(5);
        ArgumentCaptor<Bson> mark = ArgumentCaptor.forClass(Bson.class);
        when(decoratorCollection.updateOne(any(Bson.class), mark.capture())).thenReturn(matched(1));
        ArgumentCaptor<Document> inserted = ArgumentCaptor.forClass(Document.class);

        int newId = decoratorStore.supersedeDecorator(NAMESPACE, 1, "{\"type\": \"control-evaluation\"}");

        assertEquals(5, newId);
        InOrder order = inOrder(decoratorCollection);
        order.verify(decoratorCollection).updateOne(any(Bson.class), any(Bson.class));
        order.verify(decoratorCollection).insertOne(inserted.capture());
        assertEquals(5, bson(mark.getValue()).getDocument("$set").getInt32("supersededBy").getValue());
        assertEquals(5, inserted.getValue().getInteger("decoratorId"));
        assertEquals(1, inserted.getValue().getInteger("supersedes"));
        assertEquals("control-evaluation", inserted.getValue().getString("type"));
    }

    @Test
    void remove_the_mark_when_the_successor_cannot_be_inserted() {
        when(decoratorCollection.countDocuments(any(Bson.class))).thenReturn(1L);
        when(counterStore.getNextDecoratorSequenceValue()).thenReturn(5);
        when(decoratorCollection.insertOne(any(Document.class))).thenThrow(writeError(12));
        ArgumentCaptor<Bson> updates = ArgumentCaptor.forClass(Bson.class);
        when(decoratorCollection.updateOne(any(Bson.class), updates.capture())).thenReturn(matched(1));

        assertThrows(StorageWriteException.class,
                () -> decoratorStore.supersedeDecorator(NAMESPACE, 1, "{\"type\": \"control-evaluation\"}"));

        BsonDocument unmark = bson(updates.getAllValues().getLast());
        assertTrue(unmark.getDocument("$unset").containsKey("supersededBy"));
        assertTrue(unmark.getDocument("$unset").containsKey("supersededDateTime"));
    }

    @Test
    void throw_superseded_without_taking_an_id_when_superseding_an_old_decorator() {
        when(decoratorCollection.countDocuments(any(Bson.class))).thenReturn(0L, 1L);

        assertThrows(DecoratorSupersededException.class,
                () -> decoratorStore.supersedeDecorator(NAMESPACE, 1, "{\"type\": \"control-evaluation\"}"));

        verify(counterStore, never()).getNextDecoratorSequenceValue();
        verify(decoratorCollection, never()).insertOne(any(Document.class));
    }

    @Test
    void throw_not_found_without_taking_an_id_when_superseding_a_missing_decorator() {
        when(decoratorCollection.countDocuments(any(Bson.class))).thenReturn(0L, 0L);

        assertThrows(DecoratorNotFoundException.class,
                () -> decoratorStore.supersedeDecorator(NAMESPACE, 1, "{\"type\": \"control-evaluation\"}"));

        verify(counterStore, never()).getNextDecoratorSequenceValue();
    }

    @Test
    void throw_superseded_and_insert_nothing_when_a_supersede_loses_the_race_to_another() {
        when(decoratorCollection.countDocuments(any(Bson.class))).thenReturn(1L, 1L);
        when(counterStore.getNextDecoratorSequenceValue()).thenReturn(5);
        when(decoratorCollection.updateOne(any(Bson.class), any(Bson.class))).thenReturn(matched(0));

        assertThrows(DecoratorSupersededException.class,
                () -> decoratorStore.supersedeDecorator(NAMESPACE, 1, "{\"type\": \"control-evaluation\"}"));

        verify(decoratorCollection, never()).insertOne(any(Document.class));
    }

    @Test
    void return_the_history_of_a_decorator_current_first() throws Exception {
        stubHistory(superseded(1, 2), List.of(current(2, 1)), List.of());

        List<DecoratorHistoryEntry> history = decoratorStore.getDecoratorHistory(NAMESPACE, 1);

        assertEquals(List.of(2, 1), history.stream().map(DecoratorHistoryEntry::getId).toList());
        assertEquals(1, history.get(0).getSupersedes());
        assertEquals(2, history.get(1).getSupersededBy());
        assertEquals("eval-1", history.get(1).getDecorator().getUniqueId());
    }

    @Test
    void throw_not_found_for_the_history_of_a_missing_decorator() {
        stubHistory(null, List.of(), List.of());

        assertThrows(DecoratorNotFoundException.class, () -> decoratorStore.getDecoratorHistory(NAMESPACE, 1));
    }

    @Test
    void delete_the_current_decorator_then_its_history() throws Exception {
        stubHistory(current(3, 2), List.of(), List.of(superseded(2, 3).append("supersedes", 1), superseded(1, 2)));
        ArgumentCaptor<Bson> older = ArgumentCaptor.forClass(Bson.class);
        when(decoratorCollection.deleteMany(older.capture())).thenReturn(DeleteResult.acknowledged(2));

        decoratorStore.deleteCurrentDecoratorHistory(NAMESPACE, 3);

        InOrder order = inOrder(decoratorCollection);
        order.verify(decoratorCollection).deleteOne(any(Bson.class));
        order.verify(decoratorCollection).deleteMany(any(Bson.class));
        assertThat(bson(older.getValue()), is(bson(Filters.and(
                Filters.eq("namespace", NAMESPACE), Filters.in("decoratorId", List.of(2, 1))))));
    }

    @Test
    void delete_only_the_decorator_when_it_has_no_history() throws Exception {
        stubHistory(current(1, null), List.of(), List.of());

        decoratorStore.deleteCurrentDecoratorHistory(NAMESPACE, 1);

        verify(decoratorCollection).deleteOne(any(Bson.class));
        verify(decoratorCollection, never()).deleteMany(any(Bson.class));
    }

    @Test
    void keep_the_history_when_the_decorator_was_superseded_before_the_delete() {
        stubHistory(current(1, null), List.of(), List.of());
        when(decoratorCollection.deleteOne(any(Bson.class))).thenReturn(DeleteResult.acknowledged(0));
        when(decoratorCollection.countDocuments(any(Bson.class))).thenReturn(1L);

        assertThrows(DecoratorSupersededException.class, () -> decoratorStore.deleteCurrentDecoratorHistory(NAMESPACE, 1));

        verify(decoratorCollection, never()).deleteMany(any(Bson.class));
    }

    @Test
    void throw_not_found_when_a_delete_loses_to_another_delete() {
        stubHistory(null, List.of(), List.of());
        when(decoratorCollection.deleteOne(any(Bson.class))).thenReturn(DeleteResult.acknowledged(0));
        when(decoratorCollection.countDocuments(any(Bson.class))).thenReturn(0L);

        assertThrows(DecoratorNotFoundException.class, () -> decoratorStore.deleteCurrentDecoratorHistory(NAMESPACE, 1));
    }

    @Test
    void store_extended_json_keys_as_plain_data_on_create() throws Exception {
        when(counterStore.getNextDecoratorSequenceValue()).thenReturn(1);

        decoratorStore.createDecorator(NAMESPACE, EXTENDED_JSON_DECORATOR);

        assertStoredAsPlainData(insertedDecorator(decoratorCollection));
    }

    @Test
    void store_extended_json_keys_as_plain_data_on_update() throws Exception {
        ArgumentCaptor<Bson> update = ArgumentCaptor.forClass(Bson.class);
        when(decoratorCollection.updateOne(any(Bson.class), update.capture())).thenReturn(matched(1));

        decoratorStore.updateDecorator(NAMESPACE, 1, EXTENDED_JSON_DECORATOR);

        assertStoredAsPlainData(bson(update.getValue()).getDocument("$set").getDocument("decorator"));
    }

    @Test
    void store_extended_json_keys_as_plain_data_on_supersede() throws Exception {
        when(decoratorCollection.countDocuments(any(Bson.class))).thenReturn(1L);
        when(counterStore.getNextDecoratorSequenceValue()).thenReturn(5);

        decoratorStore.supersedeDecorator(NAMESPACE, 1, EXTENDED_JSON_DECORATOR);

        assertStoredAsPlainData(insertedDecorator(decoratorCollection));
    }

    @Test
    void refuse_decorator_json_that_is_not_an_object() {
        assertThrows(JsonParseException.class, () -> decoratorStore.createDecorator(NAMESPACE, "[1]"));
        assertThrows(JsonParseException.class, () -> decoratorStore.createDecorator(NAMESPACE, "null"));
        verify(decoratorCollection, never()).insertOne(any(Document.class));
    }

    @Test
    void map_a_too_large_decorator_to_the_capacity_error_on_create() {
        when(counterStore.getNextDecoratorSequenceValue()).thenReturn(42);
        when(decoratorCollection.insertOne(any(Document.class))).thenThrow(new BsonMaximumSizeExceededException("too large"));

        StorageWriteException e = assertThrows(StorageWriteException.class,
                () -> decoratorStore.createDecorator(NAMESPACE, "{\"type\": \"deployment\"}"));
        assertTrue(e.isCapacityExceeded());
    }

    @Test
    void map_a_too_large_decorator_to_the_capacity_error_on_update() {
        when(decoratorCollection.updateOne(any(Bson.class), any(Bson.class))).thenThrow(writeError(10334));

        StorageWriteException e = assertThrows(StorageWriteException.class,
                () -> decoratorStore.updateDecorator(NAMESPACE, 1, "{\"type\": \"deployment\"}"));
        assertTrue(e.isCapacityExceeded());
        verify(decoratorCollection, never()).countDocuments(any(Bson.class));
    }

    @Test
    void map_a_too_large_successor_to_the_capacity_error_on_supersede() {
        when(decoratorCollection.countDocuments(any(Bson.class))).thenReturn(1L);
        when(counterStore.getNextDecoratorSequenceValue()).thenReturn(5);
        when(decoratorCollection.insertOne(any(Document.class))).thenThrow(new BsonMaximumSizeExceededException("too large"));

        StorageWriteException e = assertThrows(StorageWriteException.class,
                () -> decoratorStore.supersedeDecorator(NAMESPACE, 1, "{\"type\": \"control-evaluation\"}"));
        assertTrue(e.isCapacityExceeded());
    }

    @Test
    void map_other_write_errors_to_a_write_failure() {
        when(counterStore.getNextDecoratorSequenceValue()).thenReturn(5);
        when(decoratorCollection.insertOne(any(Document.class))).thenThrow(writeError(12));

        StorageWriteException e = assertThrows(StorageWriteException.class,
                () -> decoratorStore.createDecorator(NAMESPACE, "{\"type\": \"deployment\"}"));
        assertFalse(e.isCapacityExceeded());
    }

    @Test
    void map_a_write_error_on_delete() {
        stubHistory(current(1, null), List.of(), List.of());
        when(decoratorCollection.deleteOne(any(Bson.class))).thenThrow(writeError(12));

        assertThrows(StorageWriteException.class, () -> decoratorStore.deleteCurrentDecoratorHistory(NAMESPACE, 1));
    }

    private static MongoWriteException writeError(int code) {
        return new MongoWriteException(new WriteError(code, "error " + code, new BsonDocument()), new ServerAddress(), List.of());
    }

    @Test
    void refuse_a_key_with_a_nul_character_before_it_takes_an_id() {
        DecoratorKeyRefusedException e = assertThrows(DecoratorKeyRefusedException.class,
                () -> decoratorStore.createDecorator(NAMESPACE, NUL_KEY_DECORATOR));

        assertEquals(DecoratorKeyRefusedException.nulCharacter().getMessage(), e.getMessage());
        verify(counterStore, never()).getNextDecoratorSequenceValue();
        verify(decoratorCollection, never()).insertOne(any(Document.class));
    }

    @Test
    void refuse_a_key_with_a_nul_character_on_update_and_supersede() {
        assertThrows(DecoratorKeyRefusedException.class, () -> decoratorStore.updateDecorator(NAMESPACE, 1, NUL_KEY_DECORATOR));
        assertThrows(DecoratorKeyRefusedException.class, () -> decoratorStore.supersedeDecorator(NAMESPACE, 1, NUL_KEY_DECORATOR));

        verify(decoratorCollection, never()).updateOne(any(Bson.class), any(Bson.class));
        verify(counterStore, never()).getNextDecoratorSequenceValue();
    }

    @Test
    void keep_a_nul_character_in_a_value() throws Exception {
        when(counterStore.getNextDecoratorSequenceValue()).thenReturn(1);

        decoratorStore.createDecorator(NAMESPACE, "{\"data\": {\"key\": \"a\\u0000b\"}}");

        assertEquals("a\0b", insertedDecorator(decoratorCollection).getDocument("data").getString("key").getValue());
    }

    @Test
    void need_the_nul_check_because_the_driver_cannot_encode_such_a_key() {
        BsonBinaryWriter writer = new BsonBinaryWriter(new BasicOutputBuffer());

        assertThrows(BsonSerializationException.class,
                () -> new DocumentCodec().encode(writer, new Document("a\0b", 1), EncoderContext.builder().build()));
    }

    @Test
    void allow_a_write_because_mongo_can_write() {
        assertDoesNotThrow(() -> decoratorStore.requireWritable());
    }

    @Test
    void throw_and_skip_the_database_when_the_namespace_does_not_exist() {
        String missing = "missing";
        when(namespaceStore.namespaceExists(missing)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> decoratorStore.getDecoratorsForNamespace(missing, null, null));
        assertThrows(NamespaceNotFoundException.class, () -> decoratorStore.getDecoratorValuesForNamespace(missing, null, null));
        assertThrows(NamespaceNotFoundException.class, () -> decoratorStore.getDecoratorById(missing, 1));
        assertThrows(NamespaceNotFoundException.class, () -> decoratorStore.createDecorator(missing, "{}"));
        assertThrows(NamespaceNotFoundException.class, () -> decoratorStore.updateDecorator(missing, 1, "{}"));
        assertThrows(NamespaceNotFoundException.class, () -> decoratorStore.supersedeDecorator(missing, 1, "{}"));
        assertThrows(NamespaceNotFoundException.class, () -> decoratorStore.getDecoratorHistory(missing, 1));
        assertThrows(NamespaceNotFoundException.class, () -> decoratorStore.deleteCurrentDecoratorHistory(missing, 1));
        verify(decoratorCollection, never()).find(any(Bson.class));
        verify(decoratorCollection, never()).aggregate(anyList());
    }

    private static final String NUL_KEY_DECORATOR = "{\"type\": \"deployment\", \"data\": {\"list\": [{\"a\\u0000b\": 1}]}}";
    private static final String EXTENDED_JSON_DECORATOR = """
            {"type": "deployment", "data": {"n": {"$numberInt": "1"}, "k": {"$maxKey": 1},
             "list": [{"$numberLong": "2"}], "big": 123456789012345678901234567890,
             "negative": -123456789012345678901234567890, "huge": 1234567890123456789012345678901234567890, "small": 3}}
            """;

    private static void assertStoredAsPlainData(BsonDocument decorator) {
        BsonDocument data = decorator.getDocument("data");
        assertEquals("1", data.getDocument("n").getString("$numberInt").getValue());
        assertEquals(1, data.getDocument("k").getInt32("$maxKey").getValue());
        assertEquals("2", data.getArray("list").getFirst().asDocument().getString("$numberLong").getValue());
        assertEquals(Decimal128.parse("123456789012345678901234567890"), data.getDecimal128("big").getValue());
        assertEquals(Decimal128.parse("-123456789012345678901234567890"), data.getDecimal128("negative").getValue());
        assertEquals(1.2345678901234568E39, data.getDouble("huge").getValue());
        assertEquals(3, data.getInt32("small").getValue());
    }
}
