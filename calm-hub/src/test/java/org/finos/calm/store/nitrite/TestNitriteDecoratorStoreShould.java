package org.finos.calm.store.nitrite;

import org.bson.json.JsonParseException;
import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.NitriteCollection;
import org.finos.calm.domain.Decorator;
import org.finos.calm.domain.exception.DecoratorNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.dizitart.no2.filters.FluentFilter.where;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doCallRealMethod;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Runs against an in-memory Nitrite, so the filters are tested as Nitrite applies them. */
class TestNitriteDecoratorStoreShould {

    private static final String NAMESPACE = "finos";
    private static final String OTHER_NAMESPACE = "workshop";
    private static final String ARCH_1 = "/calm/namespaces/finos/architectures/1/versions/1-0-0";
    private static final String ARCH_2 = "/calm/namespaces/finos/architectures/2/versions/1-0-0";

    private Nitrite db;
    private NitriteCollection collection;
    private NitriteDecoratorStore store;

    @BeforeEach
    void setUp() throws NamespaceNotFoundException {
        db = Nitrite.builder().openOrCreate();
        collection = db.getCollection(NitriteDecoratorStore.COLLECTION_NAME);

        NitriteNamespaceStore namespaceStore = mock(NitriteNamespaceStore.class);
        doCallRealMethod().when(namespaceStore).requireNamespace(anyString());
        when(namespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);
        when(namespaceStore.namespaceExists(OTHER_NAMESPACE)).thenReturn(true);

        AtomicInteger sequence = new AtomicInteger();
        NitriteCounterStore counterStore = mock(NitriteCounterStore.class);
        when(counterStore.getNextDecoratorSequenceValue()).thenAnswer(invocation -> sequence.incrementAndGet());

        store = new NitriteDecoratorStore(db, namespaceStore, counterStore);
    }

    @AfterEach
    void tearDown() {
        db.close();
    }

    private static String decoratorJson(String uniqueId, String type, String... targets) {
        return "{\"unique-id\":\"" + uniqueId + "\",\"type\":\"" + type + "\",\"target\":[\""
                + String.join("\",\"", targets) + "\"],\"data\":{\"status\":\"ok\"}}";
    }

    /** Ids 1–3 in finos, id 4 in workshop. */
    private void seed() throws NamespaceNotFoundException {
        store.createDecorator(NAMESPACE, decoratorJson("d-1", "deployment", ARCH_1));
        store.createDecorator(NAMESPACE, decoratorJson("d-2", "observability", ARCH_1, ARCH_2));
        store.createDecorator(NAMESPACE, decoratorJson("d-3", "deployment", ARCH_2));
        store.createDecorator(OTHER_NAMESPACE, decoratorJson("w-1", "deployment", ARCH_1));
    }

    @Test
    void store_each_decorator_as_its_own_document_with_type_and_target_at_the_top_level() throws Exception {
        int id = store.createDecorator(NAMESPACE, decoratorJson("d-1", "deployment", ARCH_1));

        Document stored = collection.find(where("decoratorId").eq(id)).firstOrNull();
        assertThat(stored.get("namespace", String.class), is(NAMESPACE));
        assertThat(stored.get("type", String.class), is("deployment"));
        assertThat(stored.get("target"), is(List.of(ARCH_1)));
        assertThat(stored.get("decorator", Document.class).get("unique-id", String.class), is("d-1"));
        assertThat(stored.get("decorators"), is(nullValue()));
    }

    @Test
    void return_all_ids_in_the_namespace_in_id_order() throws Exception {
        seed();

        assertThat(store.getDecoratorsForNamespace(NAMESPACE, null, null), contains(1, 2, 3));
    }

    @Test
    void filter_ids_by_type() throws Exception {
        seed();

        assertThat(store.getDecoratorsForNamespace(NAMESPACE, null, "deployment"), contains(1, 3));
    }

    @Test
    void filter_ids_by_any_entry_of_the_target_list() throws Exception {
        seed();

        assertThat(store.getDecoratorsForNamespace(NAMESPACE, ARCH_2, null), contains(2, 3));
    }

    @Test
    void filter_ids_by_target_and_type() throws Exception {
        seed();

        assertThat(store.getDecoratorsForNamespace(NAMESPACE, ARCH_1, "observability"), contains(2));
    }

    @Test
    void return_no_ids_when_the_namespace_has_no_decorators() throws Exception {
        assertThat(store.getDecoratorsForNamespace(NAMESPACE, null, null), is(empty()));
    }

    @Test
    void skip_documents_without_a_decorator_id() throws Exception {
        collection.insert(Document.createDocument("namespace", NAMESPACE).put("type", "deployment"));
        store.createDecorator(NAMESPACE, decoratorJson("d-1", "deployment", ARCH_1));

        assertThat(store.getDecoratorsForNamespace(NAMESPACE, null, null), contains(1));
    }

    @Test
    void return_decorator_values_for_a_target() throws Exception {
        seed();

        List<Decorator> values = store.getDecoratorValuesForNamespace(NAMESPACE, ARCH_1, null);

        assertThat(values.stream().map(Decorator::getUniqueId).toList(), contains("d-1", "d-2"));
    }

    @Test
    void return_decorator_values_by_type_without_a_target() throws Exception {
        seed();

        List<Decorator> values = store.getDecoratorValuesForNamespace(NAMESPACE, "", "deployment");

        assertThat(values.stream().map(Decorator::getUniqueId).toList(), contains("d-1", "d-3"));
    }

    @Test
    void skip_documents_without_decorator_content_when_returning_values() throws Exception {
        collection.insert(Document.createDocument("namespace", NAMESPACE).put("decoratorId", 9));

        assertThat(store.getDecoratorValuesForNamespace(NAMESPACE, null, null), is(empty()));
    }

    @Test
    void return_a_decorator_by_id_with_all_fields() throws Exception {
        seed();

        Decorator decorator = store.getDecoratorById(NAMESPACE, 2).orElseThrow();

        assertThat(decorator.getUniqueId(), is("d-2"));
        assertThat(decorator.getType(), is("observability"));
        assertThat(decorator.getTarget(), is(List.of(ARCH_1, ARCH_2)));
    }

    @Test
    void not_return_a_decorator_from_another_namespace() throws Exception {
        seed();

        assertThat(store.getDecoratorById(NAMESPACE, 4).isEmpty(), is(true));
    }

    @Test
    void replace_the_whole_decorator_on_update() throws Exception {
        seed();

        store.updateDecorator(NAMESPACE, 1, "{\"unique-id\":\"d-1\",\"type\":\"security\",\"target\":[\"" + ARCH_2 + "\"]}");

        Decorator updated = store.getDecoratorById(NAMESPACE, 1).orElseThrow();
        assertThat(updated.getType(), is("security"));
        assertThat(updated.getData(), is(nullValue()));
        assertThat(store.getDecoratorsForNamespace(NAMESPACE, ARCH_2, "security"), contains(1));
        assertThat(store.getDecoratorsForNamespace(NAMESPACE, ARCH_1, null), contains(2));
    }

    @Test
    void throw_decorator_not_found_when_updating_an_unknown_id() throws Exception {
        seed();

        assertThrows(DecoratorNotFoundException.class,
                () -> store.updateDecorator(NAMESPACE, 4, decoratorJson("x", "deployment", ARCH_1)));
    }

    @Test
    void delete_only_the_requested_decorator() throws Exception {
        seed();

        store.deleteDecorator(NAMESPACE, 2);

        assertThat(store.getDecoratorsForNamespace(NAMESPACE, null, null), contains(1, 3));
        assertThat(store.getDecoratorsForNamespace(OTHER_NAMESPACE, null, null), contains(4));
    }

    @Test
    void throw_decorator_not_found_when_deleting_an_unknown_id() throws Exception {
        seed();

        assertThrows(DecoratorNotFoundException.class, () -> store.deleteDecorator(NAMESPACE, 4));
    }

    @Test
    void throw_namespace_not_found_for_an_unknown_namespace() {
        String unknown = "unknown";

        assertThrows(NamespaceNotFoundException.class, () -> store.getDecoratorsForNamespace(unknown, null, null));
        assertThrows(NamespaceNotFoundException.class, () -> store.getDecoratorValuesForNamespace(unknown, null, null));
        assertThrows(NamespaceNotFoundException.class, () -> store.getDecoratorById(unknown, 1));
        assertThrows(NamespaceNotFoundException.class, () -> store.createDecorator(unknown, "{}"));
        assertThrows(NamespaceNotFoundException.class, () -> store.updateDecorator(unknown, 1, "{}"));
        assertThrows(NamespaceNotFoundException.class, () -> store.deleteDecorator(unknown, 1));
    }

    @Test
    void reject_json_that_is_not_an_object() {
        assertThrows(JsonParseException.class, () -> store.parseJsonToNitriteDocument("not-valid-json"));
        assertThrows(JsonParseException.class, () -> store.parseJsonToNitriteDocument("[1, 2]"));
        assertThrows(JsonParseException.class, () -> store.parseJsonToNitriteDocument("null"));
    }

    @Test
    void keep_extended_json_keys_as_plain_data() {
        Document result = store.parseJsonToNitriteDocument("{\"data\":{\"amount\":{\"$numberDecimal\":\"1.5\"}}}");

        Document amount = result.get("data", Document.class).get("amount", Document.class);
        assertThat(amount.get("$numberDecimal", String.class), is("1.5"));
    }

    @Test
    void map_every_decorator_field() {
        Document doc = Document.createDocument("$schema", "https://calm.finos.org/schemas/decorator.json")
                .put("unique-id", "test-decorator")
                .put("type", "deployment")
                .put("target", List.of(ARCH_1))
                .put("target-type", List.of("architecture"))
                .put("applies-to", List.of("node-1"))
                .put("data", Document.createDocument("key", "value"));

        Decorator decorator = store.documentToDecorator(doc);

        assertThat(decorator.getSchema(), is("https://calm.finos.org/schemas/decorator.json"));
        assertThat(decorator.getTargetType(), is(List.of("architecture")));
        assertThat(decorator.getAppliesTo(), is(List.of("node-1")));
        assertThat(decorator.getData(), is(notNullValue()));
    }
}
