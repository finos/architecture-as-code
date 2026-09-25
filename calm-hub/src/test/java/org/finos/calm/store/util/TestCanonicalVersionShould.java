package org.finos.calm.store.util;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.regex.Pattern;

import static org.finos.calm.resources.ResourceValidationConstants.VERSION_REGEX;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;

class TestCanonicalVersionShould {

    @ParameterizedTest
    @ValueSource(strings = {"1.0.0", "1-0-0", "1.0-0", "1-0.0", "1.00", "100"})
    void fold_every_accepted_spelling_of_a_version_onto_one_document_key(String spelling) {
        // All six are accepted by VERSION_REGEX, so all six can arrive as a path parameter.
        // Storing them verbatim would give one logical version six documents, each invisible
        // to a read using any of the other five.
        assertThat(CanonicalVersion.of(spelling), is("1.0.0"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"1.0.0", "1-0-0", "1.0-0", "1-0.0", "1.00", "100"})
    void agree_with_the_regex_about_which_spellings_are_accepted(String spelling) {
        // Pins the premise of the test above: these are folded because the API lets them in,
        // not because they were picked arbitrarily. If VERSION_REGEX is ever tightened, this
        // fails rather than leaving the fold list quietly over-broad.
        assertThat(Pattern.matches(VERSION_REGEX, spelling), is(true));
    }

    @Test
    void leave_an_already_canonical_version_untouched() {
        assertThat(CanonicalVersion.of("2.13.7"), is("2.13.7"));
    }

    @Test
    void keep_multi_digit_segments_intact() {
        // Guards against a canonicalizer that splits on characters rather than segments.
        assertThat(CanonicalVersion.of("10-20-30"), is("10.20.30"));
    }

    @Test
    void canonicalize_an_all_zero_version() {
        // 0 is matched by its own regex alternative, separate from [1-9][0-9]*.
        assertThat(CanonicalVersion.of("0-0-0"), is("0.0.0"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"1.2", "01.0.0", "1.0.0.0", "not-a-version", ""})
    void return_input_the_regex_rejects_unchanged_rather_than_guessing(String rejected) {
        // The resource layer rejects these with a 400. If the store rewrote them instead,
        // a request that should have been refused would land under a version nobody asked for.
        assertThat(CanonicalVersion.of(rejected), is(rejected));
    }

    @Test
    void pass_a_null_version_through_rather_than_throwing() {
        assertThat(CanonicalVersion.of(null), is(nullValue()));
    }

    @Test
    void return_an_overlong_input_unchanged_without_walking_it() {
        // No real version is anywhere near this long - the length guard exists purely so a
        // pathologically long value fails fast rather than exercising the group search at all.
        String pathological = "1" + "0".repeat(200) + "1";
        assertThat(CanonicalVersion.of(pathological), is(pathological));
    }

    @Test
    void backtrack_across_all_three_groups_when_the_split_is_ambiguous() {
        // "1000" has no separators, so the group boundaries are entirely ambiguous from the
        // digits alone. The first two candidate splits (1000/-/- and 100/0/-) both leave a
        // later group with nothing to consume; only 10/0/0 lets all three groups succeed.
        assertThat(CanonicalVersion.of("1000"), is("10.0.0"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"1..0", "1-", "1.0.", ".1.0"})
    void reject_a_separator_with_no_digit_group_on_one_side(String malformed) {
        assertThat(CanonicalVersion.of(malformed), is(malformed));
    }
}
