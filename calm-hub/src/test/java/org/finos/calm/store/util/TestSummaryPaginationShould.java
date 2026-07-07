package org.finos.calm.store.util;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.sameInstance;

class TestSummaryPaginationShould {

    private static final List<String> ITEMS = List.of("a", "b", "c", "d", "e");

    @Test
    void return_the_same_list_unchanged_when_limit_is_null() {
        assertThat(SummaryPagination.paginate(ITEMS, null, null), is(sameInstance(ITEMS)));
        assertThat(SummaryPagination.paginate(ITEMS, null, 2), is(sameInstance(ITEMS)));
    }

    @Test
    void apply_limit_from_the_start_when_no_offset() {
        assertThat(SummaryPagination.paginate(ITEMS, 2, null), contains("a", "b"));
        assertThat(SummaryPagination.paginate(ITEMS, 2, 0), contains("a", "b"));
    }

    @Test
    void apply_both_limit_and_offset() {
        assertThat(SummaryPagination.paginate(ITEMS, 2, 1), contains("b", "c"));
        assertThat(SummaryPagination.paginate(ITEMS, 2, 3), contains("d", "e"));
    }

    @Test
    void clamp_when_limit_exceeds_remaining_items() {
        assertThat(SummaryPagination.paginate(ITEMS, 10, 3), contains("d", "e"));
    }

    @Test
    void return_empty_when_offset_is_beyond_the_list_size() {
        assertThat(SummaryPagination.paginate(ITEMS, 2, 99), is(empty()));
    }

    @Test
    void treat_a_negative_offset_as_zero() {
        assertThat(SummaryPagination.paginate(ITEMS, 2, -5), contains("a", "b"));
    }

    @Test
    void return_empty_when_limit_is_zero_or_negative() {
        assertThat(SummaryPagination.paginate(ITEMS, 0, 0), is(empty()));
        assertThat(SummaryPagination.paginate(ITEMS, -3, 0), is(empty()));
    }
}
