package org.finos.calm.store.util;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.is;

class TestNumericVersionOrderShould {

    // Arrays.asList rather than List.of: the latter rejects nulls, and a null is one of the
    // malformed inputs this comparator has to survive.
    private static List<String> sorted(String... versions) {
        List<String> sorted = new ArrayList<>(Arrays.asList(versions));
        sorted.sort(NumericVersionOrder.ASCENDING);
        return sorted;
    }

    @Test
    void order_revisions_numerically_rather_than_lexicographically() {
        // The whole reason this exists: a string sort puts 10 before 2, which would make
        // "latest revision" wrong the moment an ADR reaches double figures.
        assertThat(sorted("10", "2", "1"), contains("1", "2", "10"));
    }

    @Test
    void put_the_highest_revision_last_so_it_reads_as_the_latest() {
        List<String> ordered = sorted("3", "11", "7");

        assertThat(ordered.get(ordered.size() - 1), is("11"));
    }

    @Test
    void order_large_revision_numbers_correctly() {
        assertThat(sorted("100", "99", "1000"), contains("99", "100", "1000"));
    }

    @Test
    void tolerate_surrounding_whitespace() {
        assertThat(sorted(" 2 ", "1"), contains("1", " 2 "));
    }

    @Test
    void sort_unparseable_values_before_every_real_revision() {
        // So a stray key can never be mistaken for the latest revision, which is what a read
        // resolving "latest" would otherwise return.
        assertThat(sorted("2", "not-a-number", "1"), contains("not-a-number", "1", "2"));
    }

    @Test
    void sort_a_null_revision_first_rather_than_throwing() {
        // A comparator that threw would turn one bad stored key into a failed listing for
        // the whole resource.
        assertThat(sorted("1", null), contains(null, "1"));
    }

    @Test
    void keep_the_order_total_for_two_unparseable_values() {
        assertThat(sorted("b", "a"), contains("a", "b"));
    }

    @Test
    void treat_two_null_revisions_as_equal() {
        assertThat(sorted(null, null), contains(null, null));
    }
}
