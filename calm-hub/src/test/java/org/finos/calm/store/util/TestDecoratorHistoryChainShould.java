package org.finos.calm.store.util;

import org.finos.calm.domain.DecoratorHistoryEntry;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.is;

class TestDecoratorHistoryChainShould {

    private static final List<DecoratorHistoryEntry> ENTRIES = List.of(
            entry(1, null, 2),
            entry(2, 1, 4),
            entry(3, null, null),
            entry(4, 2, null));

    @Test
    void return_the_history_current_first_from_any_entry_in_it() {
        assertThat(ids(DecoratorHistoryChain.of(ENTRIES, 1)), contains(4, 2, 1));
        assertThat(ids(DecoratorHistoryChain.of(ENTRIES, 2)), contains(4, 2, 1));
        assertThat(ids(DecoratorHistoryChain.of(ENTRIES, 4)), contains(4, 2, 1));
    }

    @Test
    void return_one_entry_for_a_decorator_with_no_history() {
        assertThat(ids(DecoratorHistoryChain.of(ENTRIES, 3)), contains(3));
    }

    @Test
    void return_nothing_for_a_missing_id() {
        assertThat(DecoratorHistoryChain.of(ENTRIES, 9), is(empty()));
    }

    @Test
    void stop_at_a_link_to_a_missing_entry() {
        List<DecoratorHistoryEntry> entries = List.of(entry(5, 4, 6));

        assertThat(ids(DecoratorHistoryChain.of(entries, 5)), contains(5));
    }

    @Test
    void stop_at_a_cycle() {
        List<DecoratorHistoryEntry> entries = List.of(entry(1, 2, 2), entry(2, 1, 1));

        assertThat(ids(DecoratorHistoryChain.of(entries, 1)), contains(2, 1));
    }

    @Test
    void keep_the_first_entry_for_a_duplicate_id() {
        List<DecoratorHistoryEntry> entries = List.of(entry(1, null, null), entry(1, null, 2));

        assertThat(DecoratorHistoryChain.of(entries, 1).get(0).getSupersededBy(), is((Integer) null));
    }

    private static DecoratorHistoryEntry entry(int id, Integer supersedes, Integer supersededBy) {
        return new DecoratorHistoryEntry(id, supersedes, supersededBy, null);
    }

    private static List<Integer> ids(List<DecoratorHistoryEntry> history) {
        return history.stream().map(DecoratorHistoryEntry::getId).toList();
    }
}
