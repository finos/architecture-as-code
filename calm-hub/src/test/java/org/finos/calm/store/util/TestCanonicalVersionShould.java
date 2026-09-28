package org.finos.calm.store.util;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

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

    static Stream<Arguments> provideParametersForUnseparatedDigitTests() {
        return Stream.of(
                Arguments.of("12345", "123.4.5"),
                Arguments.of("0111", "0.11.1"),
                Arguments.of("0012", "0.0.12"),
                Arguments.of("1.234", "1.23.4"),
                Arguments.of("12.3", "1.2.3"),
                Arguments.of("01.2", "0.1.2"),
                Arguments.of("1.02", "1.0.2"));
    }

    @ParameterizedTest
    @MethodSource("provideParametersForUnseparatedDigitTests")
    void split_unseparated_digits_where_the_regex_would(String spelling, String expected) {
        // Without separators the regex's greedy groups decide where one segment ends and the
        // next begins. The parser must land on the same split, not merely a valid one.
        assertThat(regexCanonicalForm(spelling), is(expected));
        assertThat(CanonicalVersion.of(spelling), is(expected));
    }

    @Test
    void agree_with_the_regex_on_every_short_string() {
        // Exhaustive over {0,1,2,'.','-'} up to length 7 (~98k strings): the parser and
        // VERSION_REGEX must agree on what is accepted and on where the digits split.
        char[] alphabet = {'0', '1', '2', '.', '-'};
        List<String> frontier = List.of("");
        for (int length = 0; length <= 7; length++) {
            for (String candidate : frontier) {
                assertThat(candidate, CanonicalVersion.of(candidate), is(regexCanonicalForm(candidate)));
            }
            List<String> next = new ArrayList<>(frontier.size() * alphabet.length);
            for (String prefix : frontier) {
                for (char c : alphabet) {
                    next.add(prefix + c);
                }
            }
            frontier = next;
        }
    }

    @Test
    void reject_non_ascii_digits_like_the_regex() {
        // [0-9] is ASCII-only; Character.isDigit would accept an Arabic-Indic digit.
        String arabicIndic = "\u0661.0.0";
        assertThat(Pattern.matches(VERSION_REGEX, arabicIndic), is(false));
        assertThat(CanonicalVersion.of(arabicIndic), is(arabicIndic));
    }

    /** What the regex itself would produce: the reference the parser is checked against. */
    private static String regexCanonicalForm(String spelling) {
        Matcher matcher = Pattern.compile(VERSION_REGEX).matcher(spelling);
        return matcher.matches()
                ? matcher.group(1) + "." + matcher.group(2) + "." + matcher.group(3)
                : spelling;
    }
}
