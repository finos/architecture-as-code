package org.finos.calm.store;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.sameInstance;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TestPageRequestShould {

    private static final List<String> ITEMS = List.of("a", "b", "c", "d", "e");

    @Test
    void report_unpaged_when_limit_is_null() {
        assertFalse(PageRequest.UNPAGED.isPaged());
        assertFalse(new PageRequest(null, 3).isPaged());
        assertTrue(new PageRequest(2, null).isPaged());
    }

    @Test
    void normalise_a_null_or_negative_offset_to_zero() {
        assertEquals(0, new PageRequest(2, null).normalizedOffset());
        assertEquals(0, new PageRequest(2, -5).normalizedOffset());
        assertEquals(3, new PageRequest(2, 3).normalizedOffset());
    }

    @Test
    void return_the_same_list_unchanged_when_unpaged() {
        assertThat(PageRequest.UNPAGED.apply(ITEMS), is(sameInstance(ITEMS)));
        assertThat(new PageRequest(null, 2).apply(ITEMS), is(sameInstance(ITEMS)));
    }

    @Test
    void apply_limit_from_the_start_when_no_offset() {
        assertThat(new PageRequest(2, null).apply(ITEMS), contains("a", "b"));
        assertThat(new PageRequest(2, 0).apply(ITEMS), contains("a", "b"));
    }

    @Test
    void apply_both_limit_and_offset() {
        assertThat(new PageRequest(2, 1).apply(ITEMS), contains("b", "c"));
        assertThat(new PageRequest(2, 3).apply(ITEMS), contains("d", "e"));
    }

    @Test
    void clamp_when_limit_exceeds_remaining_items() {
        assertThat(new PageRequest(10, 3).apply(ITEMS), contains("d", "e"));
    }

    @Test
    void return_empty_when_offset_is_beyond_the_list_size() {
        assertThat(new PageRequest(2, 99).apply(ITEMS), is(empty()));
    }

    @Test
    void treat_a_negative_offset_as_zero_when_applying() {
        assertThat(new PageRequest(2, -5).apply(ITEMS), contains("a", "b"));
    }

    @Test
    void return_empty_when_limit_is_zero_or_negative() {
        assertThat(new PageRequest(0, 0).apply(ITEMS), is(empty()));
        assertThat(new PageRequest(-3, 0).apply(ITEMS), is(empty()));
    }

    @Test
    void not_throw_and_clamp_for_a_huge_limit_that_would_overflow_int() {
        // from + limit as int arithmetic overflows to a negative bound → subList would throw.
        // long arithmetic in apply() must clamp to the list size instead.
        assertThat(new PageRequest(Integer.MAX_VALUE, 1).apply(ITEMS), contains("b", "c", "d", "e"));
        assertThat(new PageRequest(Integer.MAX_VALUE, 0).apply(ITEMS), contains("a", "b", "c", "d", "e"));
    }
}
