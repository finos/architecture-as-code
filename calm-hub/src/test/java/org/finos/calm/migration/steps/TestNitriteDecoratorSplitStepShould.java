package org.finos.calm.migration.steps;

import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.NitriteCollection;
import org.finos.calm.domain.Decorator;
import org.finos.calm.store.nitrite.NitriteCounterStore;
import org.finos.calm.store.nitrite.NitriteDecoratorStore;
import org.finos.calm.store.nitrite.NitriteNamespaceStore;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.dizitart.no2.filters.FluentFilter.where;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** NitriteDB counterpart to {@code TestMongoDecoratorSplitStepShould}, on an in-memory Nitrite. */
class TestNitriteDecoratorSplitStepShould {

    private static final String NAMESPACE = "finos";
    private static final String TARGET_A = "/calm/namespaces/finos/architectures/1/versions/1-0-0";
    private static final String TARGET_B = "/calm/namespaces/finos/architectures/2/versions/1-0-0";

    private Nitrite db;
    private NitriteCollection decorators;
    private NitriteCollection unmigrated;
    private NitriteDecoratorSplitStep step;

    @BeforeEach
    void setUp() {
        db = Nitrite.builder().openOrCreate();
        decorators = db.getCollection("decorators");
        unmigrated = db.getCollection("decoratorsUnmigrated");
        step = new NitriteDecoratorSplitStep(db);
    }

    @AfterEach
    void tearDown() {
        db.close();
    }

    private static Document entry(Object id, String uniqueId, String type, List<String> targets) {
        return Document.createDocument("decoratorId", id).put("decorator",
                Document.createDocument("unique-id", uniqueId).put("type", type).put("target", targets));
    }

    private void seedOldShape(String namespace, Document... entries) {
        decorators.insert(Document.createDocument("namespace", namespace)
                .put("decorators", new ArrayList<>(List.of(entries))));
    }

    private List<Document> all() {
        List<Document> docs = new ArrayList<>();
        decorators.find().forEach(docs::add);
        return docs;
    }

    @Test
    void run_at_schema_version_sixteen() {
        // Matches MongoDecoratorSplitStep. Each is gated on a different calm.database.mode.
        assertThat(step.fromVersion(), is(16));
    }

    @Test
    void write_one_document_per_decorator_and_remove_the_namespace_document() {
        seedOldShape(NAMESPACE,
                entry(1, "d-1", "deployment", List.of(TARGET_A)),
                entry(2, "d-2", "observability", List.of(TARGET_A, TARGET_B)));

        step.apply();

        List<Document> stored = all();
        assertThat(stored.size(), is(2));
        assertThat(stored.stream().allMatch(doc -> doc.get("decorators") == null), is(true));
        Document second = decorators.find(where("decoratorId").eq(2)).firstOrNull();
        assertThat(second.get("namespace", String.class), is(NAMESPACE));
        assertThat(second.get("type", String.class), is("observability"));
        assertThat(second.get("target"), is(List.of(TARGET_A, TARGET_B)));
    }

    @Test
    void leave_data_the_store_reads_the_same_as_before() throws Exception {
        seedOldShape(NAMESPACE,
                entry(1, "d-1", "deployment", List.of(TARGET_A)),
                entry(2, "d-2", "observability", List.of(TARGET_A, TARGET_B)));
        step.apply();

        NitriteNamespaceStore namespaceStore = mock(NitriteNamespaceStore.class);
        when(namespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);
        NitriteDecoratorStore store = new NitriteDecoratorStore(db, namespaceStore, mock(NitriteCounterStore.class));

        assertThat(store.getDecoratorsForNamespace(NAMESPACE, TARGET_B, null), contains(2));
        assertThat(store.getDecoratorValuesForNamespace(NAMESPACE, TARGET_A, "deployment").stream()
                .map(Decorator::getUniqueId).toList(), contains("d-1"));
    }

    @Test
    void keep_entries_without_a_valid_id_or_content_in_the_unmigrated_collection() {
        Document noId = entry(null, "no-id", "deployment", List.of(TARGET_A));
        Document noContent = Document.createDocument("decoratorId", 4);
        seedOldShape(NAMESPACE, entry(1, "d-1", "deployment", List.of(TARGET_A)), noId, noContent);

        step.migrate();

        assertThat(all().size(), is(1));
        Document kept = unmigrated.find(where("namespace").eq(NAMESPACE)).firstOrNull();
        assertThat(kept.get("decorators", List.class).size(), is(2));
    }

    @Test
    void stop_without_changing_data_when_a_namespace_has_duplicate_ids() {
        seedOldShape(NAMESPACE,
                entry(1, "d-1", "deployment", List.of(TARGET_A)),
                entry(1, "d-1-copy", "deployment", List.of(TARGET_A)));

        IllegalStateException e = assertThrows(IllegalStateException.class, () -> step.migrate());

        assertThat(e.getMessage(), containsString("more than one decorator with id 1"));
        List<Document> stored = all();
        assertThat(stored.size(), is(1));
        assertThat(stored.getFirst().get("decorators", List.class).size(), is(2));
    }

    @Test
    void finish_a_split_that_stopped_part_way() {
        seedOldShape(NAMESPACE,
                entry(1, "d-1", "deployment", List.of(TARGET_A)),
                entry(2, "d-2", "deployment", List.of(TARGET_B)));
        decorators.insert(NitriteDecoratorStore.toStoredDocument(NAMESPACE, 1,
                Document.createDocument("unique-id", "d-1").put("type", "deployment").put("target", List.of(TARGET_A))));

        step.migrate();

        assertThat(all().size(), is(2));
        assertThat(decorators.find(where("decoratorId").eq(1)).size(), is(1L));
    }

    @Test
    void change_nothing_when_run_a_second_time() {
        seedOldShape(NAMESPACE, entry(1, "d-1", "deployment", List.of(TARGET_A)));
        step.migrate();
        List<Document> afterFirstRun = all();

        step.migrate();

        assertThat(all().size(), is(afterFirstRun.size()));
        assertThat(all().getFirst().get("decorator", Document.class).get("unique-id", String.class), is("d-1"));
    }

    @Test
    void split_a_namespace_document_with_no_decorators_list_entries() {
        decorators.insert(Document.createDocument("namespace", NAMESPACE).put("decorators", new ArrayList<>()));

        step.migrate();

        assertThat(all().size(), is(0));
    }
}
