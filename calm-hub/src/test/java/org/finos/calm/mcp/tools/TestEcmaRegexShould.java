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
import static org.junit.jupiter.api.Assertions.assertThrows;

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
        assertThat(pattern, EcmaRegex.linear(pattern).find(text, new EcmaRegex.Budget()), is(found));
    }

    @ParameterizedTest
    @ValueSource(strings = {"(?=a)", "(?!a)", "(?<=a)", "(?<!a)", "(a)\\1", "(?<x>a)\\k<x>", "[\\S]", "\\p{ASCII}",
            "\\p{Any}", "\\p{sc=Grek}", "\\p{scx=Greek}", "\\p{LC}", "\\p{Cn}", "\\p{C}", "\\p{Letter}", "\\P{L}",
            "[\\p{sc=Latin}\\d]", "a{1001}", "(?i)a", "(?:a{1000}){1000}", "(?:a{10}){101}", "a{1000}b", "(?:){1001}",
            "(?:(?:a{1000}){1000}){1000}", "(?:a{1000}){1000000000}", "(?:a{500}|b{501})", "(?:|){501}", "(?:(?:){1000}){1000}",
            "(?:(?:(?:){1000}){1000}){1000}"})
    void refuse_a_pattern_that_has_no_linear_time_form(String pattern) {
        assertThat(pattern, EcmaRegex.linearError(pattern), notNullValue());
    }

    @Test
    void refuse_nested_repeats_before_they_are_expanded() {
        String tooLarge = "its repeats expand it to more than 1000 terms";
        assertThat(EcmaRegex.linearError("(?:a{1000}){1000}"), is(tooLarge));
        assertThat(EcmaRegex.linearError("(?:(?:a{1000}){1000}){1000}"), is(tooLarge));
        assertThat(EcmaRegex.linearError("a{1000}"), nullValue());
        assertThat(EcmaRegex.linearError("(?:a{10}){100}"), nullValue());
        assertThat(EcmaRegex.linearError("(?:a{10,}|b*){90}c"), nullValue());
        assertThat(EcmaRegex.linearError("(?:(?:){1000}){1000}"), is(tooLarge));
        assertThat(EcmaRegex.linearError("(?:(?:(?:){1000}){1000}){1000}"), is(tooLarge));
        assertThat(EcmaRegex.linearError("(?:|){500}"), nullValue());
    }

    @ParameterizedTest
    @ValueSource(strings = {"^.{1,255}$", "^[a-z0-9-]{1,128}$", "^[A-Za-z][A-Za-z0-9 ._-]{0,990}$"})
    void accept_a_common_pattern_with_a_long_repeat(String pattern) {
        assertThat(EcmaRegex.linearError(pattern), nullValue());
    }

    @Test
    void accept_a_long_literal() {
        assertThat(EcmaRegex.linearError("x".repeat(500)), nullValue());
    }

    @Test
    void refuse_quantifier_numbers_out_of_order_before_they_are_capped() {
        assertThat(EcmaRegex.error("a{2147483648,2147483647}"), notNullValue());
        assertThat(EcmaRegex.error("a{99999999999,9999999999}"), notNullValue());
        assertThat(EcmaRegex.error("a{9999999999,99999999999}"), nullValue());
        assertThat(EcmaRegex.error("a{2147483647,2147483648}"), nullValue());
    }

    @Test
    void give_the_size_of_the_expanded_program() {
        assertThat(EcmaRegex.linear("^.{1,255}$").size(), is(257L));
        assertThat(EcmaRegex.linear("(?:ab){3}c").size(), is(7L));
        assertThat(EcmaRegex.linear("a{2,}").size(), is(2L));
    }

    @Test
    void charge_each_match_to_the_budget_of_its_call() {
        EcmaRegex.Linear pattern = EcmaRegex.linear("^.{1,255}$");
        int longest = (int) (EcmaRegex.MAX_WORK / pattern.size());
        assertThat(pattern.find("a".repeat(longest), new EcmaRegex.Budget()), is(false));
        assertThrows(EcmaRegex.BudgetExceededException.class,
                () -> pattern.find("a".repeat(longest + 1), new EcmaRegex.Budget()));

        EcmaRegex.Budget shared = new EcmaRegex.Budget();
        String half = "a".repeat(longest / 2);
        assertThat(pattern.find(half, shared), is(false));
        assertThat(pattern.find(half, shared), is(false));
        assertThrows(EcmaRegex.BudgetExceededException.class, () -> pattern.find("ab", shared));
    }

    @Test
    void charge_the_budget_before_the_match_runs() {
        EcmaRegex.Budget spent = new EcmaRegex.Budget();
        spent.charge(EcmaRegex.MAX_WORK);
        assertThrows(EcmaRegex.BudgetExceededException.class, () -> EcmaRegex.linear("a").find("a", spent));
    }

    // java.util.regex takes hours on these texts. One generous bound, so a slow runner cannot fail it.
    @Test
    void match_slow_java_patterns_in_linear_time() {
        String text = "a".repeat(10_000) + "!";
        long start = System.nanoTime();
        for (String pattern : List.of("^(.*a){12}$", "(a|a)*b", "(?:|)".repeat(40) + "\\b\\B")) {
            assertThat(pattern, EcmaRegex.linear(pattern).find(text, new EcmaRegex.Budget()), is(false));
        }
        assertThat(Duration.ofNanos(System.nanoTime() - start).toSeconds() < 60, is(true));
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
