package org.finos.calm.store.nitrite;

import org.dizitart.no2.Nitrite;
import org.finos.calm.domain.Decorator;
import org.finos.calm.domain.DecoratorHistoryEntry;
import org.finos.calm.domain.exception.DecoratorNotFoundException;
import org.finos.calm.domain.exception.DecoratorSupersededException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doCallRealMethod;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TestNitriteDecoratorHistoryShould {

    private static final String NAMESPACE = "finos";

    private Nitrite database;
    private NitriteDecoratorStore store;

    @BeforeEach
    void setup() throws NamespaceNotFoundException {
        database = Nitrite.builder().openOrCreate();
        NitriteNamespaceStore namespaceStore = mock(NitriteNamespaceStore.class);
        NitriteCounterStore counterStore = mock(NitriteCounterStore.class);
        doCallRealMethod().when(namespaceStore).requireNamespace(anyString());
        when(namespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);
        when(counterStore.getNextDecoratorSequenceValue()).thenReturn(1, 2, 3, 4);
        store = new NitriteDecoratorStore(database, namespaceStore, counterStore);
    }

    @AfterEach
    void close() {
        database.close();
    }

    @Test
    void keep_the_old_decorator_and_list_only_the_new_one_when_superseding() throws Exception {
        store.createDecorator(NAMESPACE, decorator("first"));

        int newId = store.supersedeDecorator(NAMESPACE, 1, decorator("second"));

        assertThat(newId, is(2));
        assertThat(store.getDecoratorsForNamespace(NAMESPACE, null, null), contains(2));
        assertThat(store.getDecoratorValuesForNamespace(NAMESPACE, null, "control-evaluation").stream()
                .map(Decorator::getUniqueId).toList(), contains("second"));
        assertThat(store.getDecoratorById(NAMESPACE, 1).orElseThrow().getUniqueId(), is("first"));
    }

    @Test
    void return_the_history_current_first_from_any_decorator_in_it() throws Exception {
        store.createDecorator(NAMESPACE, decorator("first"));
        store.supersedeDecorator(NAMESPACE, 1, decorator("second"));
        store.supersedeDecorator(NAMESPACE, 2, decorator("third"));

        List<DecoratorHistoryEntry> history = store.getDecoratorHistory(NAMESPACE, 1);

        assertThat(history.stream().map(DecoratorHistoryEntry::getId).toList(), contains(3, 2, 1));
        assertThat(history.get(0).getSupersededBy(), is(nullValue()));
        assertThat(history.get(0).getSupersedes(), is(2));
        assertThat(history.get(2).getSupersededBy(), is(2));
        assertThat(history.get(2).getDecorator().getUniqueId(), is("first"));
        assertThat(store.getDecoratorHistory(NAMESPACE, 3), is(history));
    }

    @Test
    void refuse_to_supersede_a_decorator_twice() throws Exception {
        store.createDecorator(NAMESPACE, decorator("first"));
        store.supersedeDecorator(NAMESPACE, 1, decorator("second"));

        assertThrows(DecoratorSupersededException.class,
                () -> store.supersedeDecorator(NAMESPACE, 1, decorator("third")));
    }

    @Test
    void refuse_an_in_place_update_of_a_superseded_entry() throws Exception {
        store.createDecorator(NAMESPACE, decorator("first"));
        store.supersedeDecorator(NAMESPACE, 1, decorator("second"));

        assertThrows(DecoratorSupersededException.class,
                () -> store.updateDecorator(NAMESPACE, 1, decorator("changed")));

        assertThat(store.getDecoratorById(NAMESPACE, 1).orElseThrow().getUniqueId(), is("first"));
    }

    @Test
    void throw_decorator_not_found_when_superseding_a_missing_decorator() throws Exception {
        assertThrows(DecoratorNotFoundException.class,
                () -> store.supersedeDecorator(NAMESPACE, 1, decorator("first")));

        store.createDecorator(NAMESPACE, decorator("first"));
        assertThrows(DecoratorNotFoundException.class,
                () -> store.supersedeDecorator(NAMESPACE, 9, decorator("second")));
    }

    @Test
    void throw_decorator_not_found_for_the_history_of_a_missing_decorator() throws Exception {
        assertThrows(DecoratorNotFoundException.class, () -> store.getDecoratorHistory(NAMESPACE, 1));

        store.createDecorator(NAMESPACE, decorator("first"));
        assertThrows(DecoratorNotFoundException.class, () -> store.getDecoratorHistory(NAMESPACE, 9));
    }

    @Test
    void throw_namespace_not_found_for_an_unknown_namespace() {
        assertThrows(NamespaceNotFoundException.class, () -> store.supersedeDecorator("unknown", 1, decorator("x")));
        assertThrows(NamespaceNotFoundException.class, () -> store.getDecoratorHistory("unknown", 1));
    }

    @Test
    void refuse_deleting_a_history_that_has_a_new_successor() throws Exception {
        store.createDecorator(NAMESPACE, decorator("first"));
        store.supersedeDecorator(NAMESPACE, 1, decorator("second"));

        assertThrows(DecoratorSupersededException.class, () -> store.deleteCurrentDecoratorHistory(NAMESPACE, 1));

        assertThat(store.getDecoratorsForNamespace(NAMESPACE, null, null), contains(2));
        store.deleteCurrentDecoratorHistory(NAMESPACE, 2);
        assertThat(store.getDecoratorsForNamespace(NAMESPACE, null, null), is(empty()));
    }

    @Test
    void delete_the_whole_history_and_leave_other_decorators() throws Exception {
        store.createDecorator(NAMESPACE, decorator("first"));
        store.supersedeDecorator(NAMESPACE, 1, decorator("second"));
        store.createDecorator(NAMESPACE, decorator("other"));

        store.deleteCurrentDecoratorHistory(NAMESPACE, 2);

        assertThat(store.getDecoratorsForNamespace(NAMESPACE, null, null), contains(3));
        assertThat(store.getDecoratorById(NAMESPACE, 1).isPresent(), is(false));
        assertThat(store.getDecoratorValuesForNamespace(NAMESPACE, null, "missing"), is(empty()));
    }

    @Test
    void throw_decorator_not_found_when_deleting_a_missing_current_decorator() throws Exception {
        store.createDecorator(NAMESPACE, decorator("first"));

        assertThrows(DecoratorNotFoundException.class, () -> store.deleteCurrentDecoratorHistory(NAMESPACE, 9));
    }

    @Test
    void read_update_and_delete_a_decorator_stored_with_wrong_field_types() throws Exception {
        store.createDecorator(NAMESPACE, """
                {"unique-id": 7, "type": 5, "target": "t", "applies-to": ["a", 2], "target-type": ["architecture"]}
                """);

        Decorator stored = store.getDecoratorById(NAMESPACE, 1).orElseThrow();
        assertThat(stored.getType(), is(nullValue()));
        assertThat(stored.getTarget(), is(nullValue()));
        assertThat(stored.getAppliesTo(), is(nullValue()));
        assertThat(stored.getUniqueId(), is(nullValue()));
        assertThat(stored.getTargetType(), contains("architecture"));
        assertThat(store.getDecoratorsForNamespace(NAMESPACE, "t", "control-evaluation"), is(empty()));

        store.updateDecorator(NAMESPACE, 1, """
                {"unique-id": 7, "type": 5, "target": "t"}
                """);
        assertThat(store.getDecoratorHistory(NAMESPACE, 1).getFirst().getDecorator().getType(), is(nullValue()));

        store.deleteCurrentDecoratorHistory(NAMESPACE, 1);
        assertThat(store.getDecoratorById(NAMESPACE, 1).isPresent(), is(false));
    }

    private static String decorator(String uniqueId) {
        return """
                {"unique-id": "%s", "type": "control-evaluation", "data": {"status": "met"}}
                """.formatted(uniqueId);
    }
}
