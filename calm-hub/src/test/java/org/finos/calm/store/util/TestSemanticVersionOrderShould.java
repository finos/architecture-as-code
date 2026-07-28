package org.finos.calm.store.util;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.is;

class TestSemanticVersionOrderShould {

    private static List<String> sorted(String... versions) {
        List<String> sorted = new ArrayList<>(List.of(versions));
        sorted.sort(SemanticVersionOrder.ASCENDING);
        return sorted;
    }

    @Test
    void order_by_major_then_minor_then_patch() {
        assertThat(sorted("2.0.0", "1.1.0", "1.0.1", "1.0.0"),
                contains("1.0.0", "1.0.1", "1.1.0", "2.0.0"));
    }

    @Test
    void order_numerically_rather_than_lexicographically() {
        // The whole reason this class exists: a plain string sort puts 1.10.0 before 1.9.0.
        assertThat(sorted("1.10.0", "1.9.0", "1.2.0"),
                contains("1.2.0", "1.9.0", "1.10.0"));
    }

    @Test
    void order_double_digit_major_versions_numerically() {
        assertThat(sorted("10.0.0", "9.0.0", "2.0.0"),
                contains("2.0.0", "9.0.0", "10.0.0"));
    }

    @Test
    void not_let_a_large_patch_outrank_a_higher_minor() {
        // Guards the segment-by-segment comparison: packing segments into one integer
        // would let a big patch number overflow into the minor version's range.
        assertThat(sorted("1.1.0", "1.0.999999"),
                contains("1.0.999999", "1.1.0"));
    }

    @Test
    void sort_unparseable_versions_first_rather_than_throwing() {
        assertThat(sorted("1.0.0", "not-a-version"),
                contains("not-a-version", "1.0.0"));
    }

    @Test
    void sort_versions_with_the_wrong_segment_count_first_rather_than_throwing() {
        assertThat(sorted("1.0.0", "1.0", "1.0.0.0"),
                contains("1.0", "1.0.0.0", "1.0.0"));
    }

    @Test
    void sort_a_non_numeric_segment_first_rather_than_throwing() {
        // Distinct from the wrong-segment-count case: this has exactly three segments, so
        // it gets as far as parsing them and has to survive the parse failing.
        assertThat(sorted("1.0.0", "1.x.0"), contains("1.x.0", "1.0.0"));
    }

    @Test
    void ignore_earlier_segments_of_a_version_whose_later_segment_is_non_numeric() {
        // A partially-parsed version must not rank on its valid leading segments — 9.0.x
        // would otherwise outrank every real 1.x.y release.
        assertThat(sorted("1.0.0", "9.0.x"), contains("9.0.x", "1.0.0"));
    }

    @Test
    void order_equal_ranking_values_deterministically() {
        // Two unparseable values both rank as 0.0.0 — the string tiebreak keeps the
        // overall order total, so sorting is stable rather than arbitrary.
        assertThat(sorted("zzz", "aaa"), contains("aaa", "zzz"));
    }

    @Test
    void treat_identical_versions_as_equal() {
        assertThat(SemanticVersionOrder.ASCENDING.compare("1.2.3", "1.2.3"), is(0));
    }
}
