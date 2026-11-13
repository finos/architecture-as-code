package org.finos.calm.store.mongo;

import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.result.DeleteResult;
import com.mongodb.client.result.UpdateResult;
import org.bson.BsonDocument;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.finos.calm.domain.Decorator;
import org.finos.calm.domain.exception.DecoratorNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doCallRealMethod;
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

    private static final String NAMESPACE = "finos";
    private static final String TARGET = "/calm/namespaces/finos/architectures/1/versions/1-0-0";

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

        decoratorStore = new MongoDecoratorStore(database, namespaceStore, counterStore);
    }

    private static Document decorator(String uniqueId, String type) {
        return new Document("unique-id", uniqueId).append("type", type).append("target", List.of(TARGET));
    }

    private static Document stored(int id, Document decorator) {
        return MongoDecoratorStore.toStoredDocument(NAMESPACE, id, decorator);
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

    private static BsonDocument bson(Bson filter) {
        return filter.toBsonDocument();
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
    void query_only_by_namespace_when_no_filters_are_given() throws NamespaceNotFoundException {
        ArgumentCaptor<Bson> filter = stubFind(List.of(
                stored(1, decorator("d-1", "deployment")),
                stored(2, decorator("d-2", "observability"))));

        List<Integer> ids = decoratorStore.getDecoratorsForNamespace(NAMESPACE, null, "");

        assertThat(ids, contains(1, 2));
        assertThat(bson(filter.getValue()), is(bson(Filters.and(List.of(Filters.eq("namespace", NAMESPACE))))));
    }

    @Test
    void push_target_and_type_filters_into_the_query() throws NamespaceNotFoundException {
        ArgumentCaptor<Bson> filter = stubFind(List.of(stored(1, decorator("d-1", "deployment"))));

        List<Integer> ids = decoratorStore.getDecoratorsForNamespace(NAMESPACE, TARGET, "deployment");

        assertThat(ids, contains(1));
        assertThat(bson(filter.getValue()), is(bson(Filters.and(List.of(
                Filters.eq("namespace", NAMESPACE),
                Filters.eq("target", TARGET),
                Filters.eq("type", "deployment"))))));
    }

    @Test
    void ignore_a_blank_target_filter() throws NamespaceNotFoundException {
        ArgumentCaptor<Bson> filter = stubFind(List.of());

        decoratorStore.getDecoratorValuesForNamespace(NAMESPACE, " ", null);

        assertThat(bson(filter.getValue()), is(bson(Filters.and(List.of(Filters.eq("namespace", NAMESPACE))))));
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
    void get_a_decorator_by_namespace_and_id() throws NamespaceNotFoundException {
        ArgumentCaptor<Bson> filter = stubFind(List.of(stored(3, decorator("d-3", "deployment"))));

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
    void insert_one_document_when_creating_a_decorator() throws NamespaceNotFoundException {
        when(counterStore.getNextDecoratorSequenceValue()).thenReturn(5);
        ArgumentCaptor<Document> inserted = ArgumentCaptor.forClass(Document.class);

        int id = decoratorStore.createDecorator(NAMESPACE,
                "{\"unique-id\": \"d-5\", \"type\": \"deployment\", \"target\": [\"" + TARGET + "\"]}");

        assertThat(id, is(5));
        verify(decoratorCollection).insertOne(inserted.capture());
        assertThat(inserted.getValue().getInteger("decoratorId"), is(5));
        assertThat(inserted.getValue().getString("type"), is("deployment"));
        assertThat(inserted.getValue().get("target"), is(List.of(TARGET)));
    }

    @Test
    void replace_the_stored_document_when_updating_a_decorator() throws Exception {
        when(decoratorCollection.replaceOne(any(Bson.class), any(Document.class)))
                .thenReturn(UpdateResult.acknowledged(1, 0L, null));
        ArgumentCaptor<Document> replacement = ArgumentCaptor.forClass(Document.class);

        decoratorStore.updateDecorator(NAMESPACE, 1, "{\"unique-id\": \"d-1\", \"type\": \"observability\"}");

        verify(decoratorCollection).replaceOne(any(Bson.class), replacement.capture());
        assertThat(replacement.getValue().getString("type"), is("observability"));
    }

    @Test
    void throw_when_updating_a_decorator_that_does_not_exist() {
        when(decoratorCollection.replaceOne(any(Bson.class), any(Document.class)))
                .thenReturn(UpdateResult.acknowledged(0, 0L, null));

        assertThrows(DecoratorNotFoundException.class,
                () -> decoratorStore.updateDecorator(NAMESPACE, 1, "{\"type\": \"deployment\"}"));
    }

    @Test
    void delete_one_document_when_deleting_a_decorator() throws Exception {
        when(decoratorCollection.deleteOne(any(Bson.class))).thenReturn(DeleteResult.acknowledged(1));

        decoratorStore.deleteDecorator(NAMESPACE, 1);

        verify(decoratorCollection).deleteOne(any(Bson.class));
    }

    @Test
    void throw_when_deleting_a_decorator_that_does_not_exist() {
        when(decoratorCollection.deleteOne(any(Bson.class))).thenReturn(DeleteResult.acknowledged(0));

        assertThrows(DecoratorNotFoundException.class, () -> decoratorStore.deleteDecorator(NAMESPACE, 1));
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
        assertThrows(NamespaceNotFoundException.class, () -> decoratorStore.deleteDecorator(missing, 1));
        verify(decoratorCollection, never()).find(any(Bson.class));
    }
}
