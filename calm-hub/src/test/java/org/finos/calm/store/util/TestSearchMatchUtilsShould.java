package org.finos.calm.store.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TestSearchMatchUtilsShould {

    @Test
    void return_true_when_value_contains_query_case_insensitive() {
        assertTrue(SearchMatchUtils.containsIgnoreCase("Payment Architecture", "payment"));
    }

    @Test
    void return_true_when_value_contains_query_exact_case() {
        assertTrue(SearchMatchUtils.containsIgnoreCase("Payment Architecture", "payment"));
    }

    @Test
    void return_false_when_value_does_not_contain_query() {
        assertFalse(SearchMatchUtils.containsIgnoreCase("Payment Architecture", "nonexistent"));
    }

    @Test
    void return_false_when_value_is_null() {
        assertFalse(SearchMatchUtils.containsIgnoreCase(null, "query"));
    }

    @Test
    void return_true_for_substring_match() {
        assertTrue(SearchMatchUtils.containsIgnoreCase("api-gateway", "api"));
    }

    @Test
    void return_true_for_uppercase_query_against_lowercase_value() {
        assertTrue(SearchMatchUtils.containsIgnoreCase("hello world", "hello"));
    }

    @Test
    void return_empty_string_for_null_value() {
        assertEquals("", SearchMatchUtils.nullToEmpty(null));
    }

    @Test
    void return_original_string_for_non_null_value() {
        assertEquals("test", SearchMatchUtils.nullToEmpty("test"));
    }

    @Test
    void return_empty_string_unchanged() {
        assertEquals("", SearchMatchUtils.nullToEmpty(""));
    }
}
