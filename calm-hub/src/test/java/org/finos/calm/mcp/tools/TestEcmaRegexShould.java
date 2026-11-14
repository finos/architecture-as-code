package org.finos.calm.mcp.tools;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.time.Duration;
import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;

class TestEcmaRegexShould {

    @ParameterizedTest
    @ValueSource(strings = {
            "", "abc", "^[a-z][a-z0-9-]*$", "^https?://", "^(?:/(?:[^~/]|~[01])*)*$",
            "^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z-]+)?$",
            "^/(?:[A-Za-z0-9._~-]+|\\{[A-Za-z][A-Za-z0-9_-]*\\})$|^/$",
            "a*?b+?c??d{2}e{2,}f{2,3}?", "(?=a)(?!b)(?<=c)(?<!d)", "(?<year>\\d{4})-\\k<year>", "(a)(b)\\2\\1",
            "\\bword\\B", "[\\d\\s\\w\\D\\S\\W]", "[^\\]\\-\\b]", "[-a]", "[a-]", "[]", "[^]", "\\x41\\u0041\\u{1F600}",
            "\\uD83D\\uDE00", "\\cJ\\f\\n\\r\\t\\v\\0", "\\^\\$\\\\\\.\\*\\+\\?\\(\\)\\[\\]\\{\\}\\|\\/",
            "\\p{L}\\p{Lu}\\P{Letter}\\p{Script=Latin}\\p{sc=Grek}\\p{scx=Old_Italic}\\p{gc=Nd}\\p{ASCII_Hex_Digit}",
            "[\\p{L}_]", "a|b|", ".", "[&]", "😀+"
    })
    void accept_an_ecma_262_pattern(String pattern) {
        assertThat(EcmaRegex.error(pattern), nullValue());
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "(?i)abc", "(?>a)", "(?#comment)", "a++", "a*+", "a?+", "a{2}+", "\\Qa.b\\E", "\\h+", "\\H",
            "\\Aabc", "abc\\z", "abc\\Z", "\\G", "\\R", "\\X", "\\e", "\\a", "[a-z&&[^x]]", "[[a]]", "\\x{41}",
            "\\N{LATIN SMALL LETTER A}", "\\pL", "\\p{Punct}", "\\p{IsLatin}", "\\p{InGreek}", "\\p{javaLowerCase}",
            "\\p{sc=LATIN}", "\\p{Script=Nope}", "\\p{Foo=Bar}", "\\p{L", "\\012", "\\1", "(a)\\2", "\\k<x>", "(?<x>a)\\k<y>",
            "(?<x>a)(?<x>b)", "(?<1x>a)", "\\-", "\\y", "*a", "a**", "^*", "$+", "\\b+", "(?=a)*", "(?<=a)+", "a{", "a{1",
            "a{,2}", "a{3,2}", "}", "]", "(", ")", "(a", "[a", "[z-a]", "[\\d-z]", "[a-\\w]", "\\", "\\u12", "\\u{110000}",
            "\\u{}", "\\xG0", "\\c1", "a|*"
    })
    void refuse_a_pattern_that_is_not_ecma_262(String pattern) {
        assertThat(pattern, EcmaRegex.error(pattern), notNullValue());
    }

    // Valid in current ECMA-262, but older engines refuse modifiers and repeated group names, and Java reads && in a class as an intersection.
    @ParameterizedTest
    @ValueSource(strings = {"(?i:abc)", "(?-i:a)", "[a&&b]", "(?<x>a)|(?<x>b)"})
    void refuse_a_pattern_that_clients_or_java_read_differently(String pattern) {
        assertThat(pattern, EcmaRegex.error(pattern), notNullValue());
    }

    // Each row: pattern, text, and whether ECMA-262 with the u flag finds a match.
    @ParameterizedTest
    @CsvSource(delimiter = '|', quoteCharacter = '"', value = {
            "^a.c$|abc|true", "a.c|\"a\nc\"|false", "a.c|a\u2028c|false", "a.c|a😀c|true", "^a$|\"a\n\"|false",
            "\\s|\"\u00A0\"|true", "\\s|\"\uFEFF\"|true", "[\\s]|\"\u3000\"|true", "\\S|\"\u00A0\"|false", "\\d|٣|false", "\\w|é|false",
            "\\bb|a b|true", "[]|a|false", "[^]|\"\n\"|true", "\\u{1F600}|😀|true", "\\uD83D\\uDE00|😀|true",
            "[\\-\\/\\]]|]|true", "(?<year>\\d{4})|2026|true", "\\cJ|\"\n\"|true", "\\0|\"\u0000\"|true",
            "a{2,3}?b|aab|true", "\"^(a|b)*$\"|abab|true", "x*|b|true", "(?:)|b|true", "\\x41|A|true", "[a-c]|b|true",
            "^[^a-c]$|d|true", "^[^a-c]$|b|false", "\\^\\$\\.|^$.|true"
    })
    void match_with_the_ecma_262_meaning_in_linear_time(String pattern, String text, boolean found) {
        assertThat(EcmaRegex.linearError(pattern), nullValue());
        assertThat(pattern, EcmaRegex.linear(pattern).matcher(text).find(), is(found));
    }

    @ParameterizedTest
    @ValueSource(strings = {"(?=a)", "(?!a)", "(?<=a)", "(?<!a)", "(a)\\1", "(?<x>a)\\k<x>", "[\\S]", "\\p{ASCII}",
            "\\p{Any}", "\\p{sc=Grek}", "\\p{scx=Greek}", "\\p{LC}", "\\p{Cn}", "\\p{C}", "\\p{Letter}", "\\P{L}",
            "[\\p{sc=Latin}\\d]", "a{101}", "(?i)a", "(?:a{1000}){1000}", "(?:a{10}){11}", "a{100}b", "(?:){101}",
            "(?:(?:a{1000}){1000}){1000}", "(?:a{1000}){1000000000}", "(?:a{50}|b{51})", "(?:|){51}", "(?:(?:){1000}){1000}",
            "(?:(?:(?:){1000}){1000}){1000}"})
    void refuse_a_pattern_that_has_no_linear_time_form(String pattern) {
        assertThat(pattern, EcmaRegex.linearError(pattern), notNullValue());
    }

    @Test
    void refuse_nested_repeats_before_they_are_expanded() {
        assertThat(EcmaRegex.linearError("(?:a{1000}){1000}"), is("its repeats expand it to more than 100 terms"));
        assertThat(EcmaRegex.linearError("(?:(?:a{1000}){1000}){1000}"), is("its repeats expand it to more than 100 terms"));
        assertThat(EcmaRegex.linearError("a{100}"), nullValue());
        assertThat(EcmaRegex.linearError("(?:a{10}){10}"), nullValue());
        assertThat(EcmaRegex.linearError("(?:a{10,}|b*){9}c"), nullValue());
        assertThat(EcmaRegex.linearError("(?:(?:){1000}){1000}"), is("its repeats expand it to more than 100 terms"));
        assertThat(EcmaRegex.linearError("(?:(?:(?:){1000}){1000}){1000}"), is("its repeats expand it to more than 100 terms"));
        assertThat(EcmaRegex.linearError("(?:|){50}"), nullValue());
    }

    @Test
    void match_an_accepted_pattern_of_the_largest_size_in_linear_time() {
        com.google.re2j.Pattern largest = EcmaRegex.linear("^(?:[a-z]{0,10}x){9}$");
        long small = time(() -> largest.matcher("a".repeat(100_000) + "!").find());
        long large = time(() -> largest.matcher("a".repeat(1_000_000) + "!").find());

        assertThat(large < 20 * Math.max(small, 50), is(true));
        assertThat(large < 10_000, is(true));
    }

    private static long time(Runnable run) {
        long start = System.nanoTime();
        run.run();
        return Duration.ofNanos(System.nanoTime() - start).toMillis();
    }

    @Test
    void match_slow_java_patterns_in_linear_time() {
        String text = "a".repeat(100_000) + "!";
        for (String pattern : List.of("^(.*a){12}$", "(a|a)*b", "(?:|)".repeat(40) + "\\b\\B")) {
            long start = System.nanoTime();
            assertThat(pattern, EcmaRegex.linear(pattern).matcher(text).find(), is(false));
            assertThat(pattern, Duration.ofNanos(System.nanoTime() - start).toMillis() < 5_000, is(true));
        }
    }

    @Test
    void refuse_a_pattern_whose_groups_are_nested_too_deep() {
        String deepest = "(".repeat(EcmaRegex.MAX_DEPTH) + "a" + ")".repeat(EcmaRegex.MAX_DEPTH);
        String deeper = "(?:".repeat(EcmaRegex.MAX_DEPTH + 1) + "a" + ")".repeat(EcmaRegex.MAX_DEPTH + 1);

        assertThat(EcmaRegex.error(deepest), nullValue());
        assertThat(EcmaRegex.error("(?=" + deepest + ")"), is("groups are nested more than 64 deep (at character 67)"));
        assertThat(EcmaRegex.error(deeper), is("groups are nested more than 64 deep (at character 193)"));
        assertThat(EcmaRegex.error("(a)".repeat(300)), nullValue());
    }

    @Test
    void refuse_a_pattern_that_is_too_long() {
        assertThat(EcmaRegex.error("a".repeat(EcmaRegex.MAX_LENGTH)), nullValue());
        assertThat(EcmaRegex.error("😀".repeat(EcmaRegex.MAX_LENGTH)), nullValue());
        assertThat(EcmaRegex.error("a".repeat(EcmaRegex.MAX_LENGTH + 1)), is("it is longer than 1000 characters"));
        assertThat(EcmaRegex.error("(".repeat(1_000_000)), is("it is longer than 1000 characters"));
    }
}
