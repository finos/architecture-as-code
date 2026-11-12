package org.finos.calm.store.nitrite;

import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.finos.calm.domain.Decorator;
import org.finos.calm.domain.DecoratorHistoryEntry;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.matchesPattern;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doCallRealMethod;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TestNitriteDecoratorTimestampsShould {

    private static final String NAMESPACE = "finos";
    private static final String UTC_MILLIS = "\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z";

    private Nitrite database;
    private NitriteDecoratorStore store;

    @BeforeEach
    void setup() throws NamespaceNotFoundException {
        database = Nitrite.builder().openOrCreate();
        NitriteNamespaceStore namespaceStore = mock(NitriteNamespaceStore.class);
        NitriteCounterStore counterStore = mock(NitriteCounterStore.class);
        doCallRealMethod().when(namespaceStore).requireNamespace(anyString());
        when(namespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);
        when(counterStore.getNextDecoratorSequenceValue()).thenReturn(1, 2, 3);
        store = new NitriteDecoratorStore(database, namespaceStore, counterStore);
    }

    @AfterEach
    void close() {
        database.close();
    }

    @Test
    void record_the_same_creation_and_update_time_when_creating() throws Exception {
        store.createDecorator(NAMESPACE, decorator("first"));

        Decorator created = store.getDecoratorById(NAMESPACE, 1).orElseThrow();

        assertThat(created.getCreationDateTime(), matchesPattern(UTC_MILLIS));
        assertThat(created.getUpdateDateTime(), is(created.getCreationDateTime()));
        assertThat(store.getDecoratorValuesForNamespace(NAMESPACE, null, null), contains(created));
    }

    @Test
    void keep_the_creation_time_and_move_the_update_time_when_updating_in_place() throws Exception {
        store.createDecorator(NAMESPACE, decorator("first"));
        Decorator created = store.getDecoratorById(NAMESPACE, 1).orElseThrow();
        Thread.sleep(5);

        store.updateDecorator(NAMESPACE, 1, decorator("changed"));

        Decorator updated = store.getDecoratorById(NAMESPACE, 1).orElseThrow();
        assertThat(updated.getUniqueId(), is("changed"));
        assertThat(updated.getCreationDateTime(), is(created.getCreationDateTime()));
        assertThat(updated.getUpdateDateTime().compareTo(created.getUpdateDateTime()), is(greaterThan(0)));
    }

    @Test
    void keep_the_times_of_a_superseded_decorator_and_record_when_it_was_superseded() throws Exception {
        store.createDecorator(NAMESPACE, decorator("first"));
        Decorator first = store.getDecoratorById(NAMESPACE, 1).orElseThrow();
        Thread.sleep(5);

        store.supersedeDecorator(NAMESPACE, 1, decorator("second"));

        List<DecoratorHistoryEntry> history = store.getDecoratorHistory(NAMESPACE, 1);
        DecoratorHistoryEntry current = history.get(0);
        DecoratorHistoryEntry old = history.get(1);
        assertThat(old.getDecorator(), is(first));
        assertThat(old.getSupersededDateTime(), is(current.getDecorator().getCreationDateTime()));
        assertThat(old.getSupersededDateTime(), is(not(first.getUpdateDateTime())));
        assertThat(current.getSupersededDateTime(), is(nullValue()));
        assertThat(current.getDecorator().getUpdateDateTime(), is(current.getDecorator().getCreationDateTime()));
    }

    @Test
    void return_no_times_for_a_decorator_stored_before_hub_recorded_them() throws Exception {
        Document legacy = Document.createDocument("decoratorId", 7)
                .put("decorator", Document.createDocument("unique-id", "legacy").put("type", "deployment"));
        database.getCollection("decorators").insert(Document.createDocument("namespace", NAMESPACE)
                .put("decorators", new ArrayList<>(List.of(legacy))));

        Decorator decorator = store.getDecoratorById(NAMESPACE, 7).orElseThrow();

        assertThat(decorator.getCreationDateTime(), is(nullValue()));
        assertThat(decorator.getUpdateDateTime(), is(nullValue()));
        assertThat(store.getDecoratorHistory(NAMESPACE, 7).getFirst().getSupersededDateTime(), is(nullValue()));
    }

    // Hub does not know when an old decorator was created, so it does not invent a creation time.
    @Test
    void give_an_old_decorator_only_an_update_time_when_updating_it_in_place() throws Exception {
        Document legacy = Document.createDocument("decoratorId", 7)
                .put("decorator", Document.createDocument("unique-id", "legacy").put("type", "deployment"));
        database.getCollection("decorators").insert(Document.createDocument("namespace", NAMESPACE)
                .put("decorators", new ArrayList<>(List.of(legacy))));

        store.updateDecorator(NAMESPACE, 7, decorator("changed"));

        Decorator updated = store.getDecoratorById(NAMESPACE, 7).orElseThrow();
        assertThat(updated.getCreationDateTime(), is(nullValue()));
        assertThat(updated.getUpdateDateTime(), matchesPattern(UTC_MILLIS));
    }

    private static String decorator(String uniqueId) {
        return """
                {"unique-id": "%s", "type": "control-evaluation", "data": {"status": "met"}}
                """.formatted(uniqueId);
    }
}
