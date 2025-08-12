package org.finos.calm.store.util;

import org.dizitart.no2.collection.Document;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.*;

public class TestTypeSafeNitriteDocumentShould {

    @Test
    void return_empty_list_when_key_missing() {
        Document document = Document.createDocument();
        TypeSafeNitriteDocument<String> wrapper = new TypeSafeNitriteDocument<>(document, String.class);

        List<String> actual = wrapper.getList("missing");
        assertThat(actual, is(empty()));
    }

    @Test
    void filter_out_items_not_matching_type() {
        Document document = Document.createDocument();
        document.put("mixed", Arrays.asList("one", 2, "three", 4L, "five"));

        TypeSafeNitriteDocument<String> wrapper = new TypeSafeNitriteDocument<>(document, String.class);
        List<String> actual = wrapper.getList("mixed");

        assertThat(actual, contains("one", "three", "five"));
    }

    @Test
    void return_all_items_when_all_match_type() {
        Document document = Document.createDocument();
        document.put("values", Arrays.asList(1, 2, 3));

        TypeSafeNitriteDocument<Integer> wrapper = new TypeSafeNitriteDocument<>(document, Integer.class);
        List<Integer> actual = wrapper.getList("values");

        assertThat(actual, contains(1, 2, 3));
    }

    // New map tests
    @Test
    void return_empty_map_when_key_missing() {
        Document document = Document.createDocument();
        TypeSafeNitriteDocument<String> wrapper = new TypeSafeNitriteDocument<>(document, String.class);

        Map<String, String> actual = wrapper.getMap("missingMap");
        assertThat(actual.entrySet(), is(empty()));
    }

    @Test
    void filter_out_entries_not_matching_type() {
        Document document = Document.createDocument();
        Map<String, Object> mixed = new LinkedHashMap<>();
        mixed.put("a", "alpha");
        mixed.put("b", 2); // not a String
        mixed.put("c", "charlie");
        mixed.put("d", 4L); // not a String
        document.put("mixedMap", mixed);

        TypeSafeNitriteDocument<String> wrapper = new TypeSafeNitriteDocument<>(document, String.class);
        Map<String, String> actual = wrapper.getMap("mixedMap");

        assertThat(actual.size(), is(2));
        assertThat(actual, hasEntry("a", "alpha"));
        assertThat(actual, hasEntry("c", "charlie"));
        assertThat(actual, not(hasKey("b")));
        assertThat(actual, not(hasKey("d")));
    }

    @Test
    void return_all_entries_when_all_match_type() {
        Document document = Document.createDocument();
        Map<String, Integer> numbers = new LinkedHashMap<>();
        numbers.put("one", 1);
        numbers.put("two", 2);
        numbers.put("three", 3);
        document.put("numbers", numbers);

        TypeSafeNitriteDocument<Integer> wrapper = new TypeSafeNitriteDocument<>(document, Integer.class);
        Map<String, Integer> actual = wrapper.getMap("numbers");

        assertThat(actual.size(), is(3));
        assertThat(actual, hasEntry("one", 1));
        assertThat(actual, hasEntry("two", 2));
        assertThat(actual, hasEntry("three", 3));
    }
}
