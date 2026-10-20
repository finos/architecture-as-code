package org.finos.calm.store.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TestPatternReferenceMatcherShould {

    private static final String NAMESPACE = "finos";
    private static final String NAME = "api-gateway";
    private static final String VERSION = "1.0.0";
    private static final String PATH = "https://h/calm/namespaces/finos/patterns/api-gateway/versions/";

    private static boolean references(String schema, String namespace, String version) {
        return PatternReferenceMatcher.references(schema, PatternReferenceMatcher.pathPattern(namespace, NAME), version);
    }

    private static boolean matches(String schema) {
        return references(schema, NAMESPACE, VERSION);
    }

    @Test
    void match_the_type_segment_in_any_case() {
        assertTrue(matches("https://h/calm/namespaces/finos/Patterns/api-gateway/versions/1.0.0"));
        assertTrue(matches("https://h/calm/namespaces/finos/PATTERNS/api-gateway/versions/1.0.0"));
    }

    @Test
    void match_the_namespace_the_name_and_the_other_segments_exactly() {
        assertFalse(matches("https://h/calm/namespaces/FINOS/patterns/api-gateway/versions/1.0.0"));
        assertFalse(matches("https://h/calm/namespaces/finos/patterns/API-gateway/versions/1.0.0"));
        assertFalse(matches("https://h/calm/namespaces/finos/patterns/api-gateway/Versions/1.0.0"));
        assertFalse(matches("https://h/CALM/namespaces/finos/patterns/api-gateway/versions/1.0.0"));
    }

    @Test
    void match_a_reference_regardless_of_the_host_it_was_written_under() {
        assertTrue(matches("https://hub.corp.com/calm/namespaces/finos/patterns/api-gateway/versions/1.0.0"));
        assertTrue(matches("https://calm.example.org/calm/namespaces/finos/patterns/api-gateway/versions/1.0.0"));
        assertTrue(matches("http://localhost:8080/calm/namespaces/finos/patterns/api-gateway/versions/1.0.0"));
    }

    @Test
    void use_the_last_reference_when_the_schema_contains_the_path_twice() {
        assertTrue(matches(PATH + "2.0.0 " + PATH + "1.0.0"));
        assertFalse(matches(PATH + "1.0.0 " + PATH + "2.0.0"));
        assertTrue(matches(PATH + "2.0.0 https://h/calm/namespaces/finos/Patterns/api-gateway/versions/1.0.0"));
    }

    @Test
    void find_a_reference_that_overlaps_an_earlier_one() {
        assertTrue(matches("https://h/calm/namespaces/finos/patterns/api-gateway/versions"
                + "/calm/namespaces/finos/patterns/api-gateway/versions/1.0.0"));
    }

    @Test
    void distinguish_one_version_from_another() {
        assertFalse(matches(PATH + "2.0.0"));
    }

    @Test
    void not_match_a_pattern_whose_name_merely_starts_the_same() {
        assertFalse(matches("https://h/calm/namespaces/finos/patterns/api-gateway-v2/versions/1.0.0"));
    }

    @Test
    void not_match_the_same_pattern_name_in_another_namespace() {
        assertFalse(matches("https://h/calm/namespaces/other/patterns/api-gateway/versions/1.0.0"));
    }

    @Test
    void not_match_an_architecture_reference_of_the_same_shape() {
        assertFalse(matches("https://h/calm/namespaces/finos/architectures/api-gateway/versions/1.0.0"));
    }

    @Test
    void treat_a_dot_in_a_namespace_as_a_literal_rather_than_a_wildcard() {
        assertTrue(references("https://h/calm/namespaces/finos.calm/patterns/api-gateway/versions/1.0.0", "finos.calm", VERSION));
        assertFalse(references("https://h/calm/namespaces/finosXcalm/patterns/api-gateway/versions/1.0.0", "finos.calm", VERSION));
    }

    @Test
    void not_match_a_meta_schema_a_published_docs_url_or_no_schema() {
        assertFalse(matches("https://calm.finos.org/release/1.2/meta/calm.json"));
        assertFalse(matches("https://calm.finos.org/getting-started/conference-signup.pattern.json"));
        assertFalse(matches(PATH));
        assertFalse(matches(null));
    }

    @Test
    void not_match_a_reference_with_anything_after_the_version() {
        assertFalse(matches(PATH + "1.0.0\n"));
        assertFalse(matches(PATH + "1.0.0/"));
    }

    @Test
    void match_every_spelling_of_the_version_the_api_accepts() {
        // rewriteId writes the requested path version into $id without canonicalising it, so a
        // stored reference can carry any of these for the same version.
        for (String spelling : new String[]{"1.0.0", "1-0-0", "1.0-0", "1-0.0", "1.00", "100"}) {
            assertTrue(matches(PATH + spelling), "missed " + spelling);
        }
    }

    @Test
    void match_when_the_caller_and_the_stored_reference_spell_the_version_differently() {
        assertTrue(references(PATH + "1.0.0", NAMESPACE, "1-0-0"));
    }

    @Test
    void still_separate_versions_that_are_genuinely_different() {
        assertFalse(references(PATH + "1.0.0", NAMESPACE, "1.0.1"));
        assertFalse(references(PATH + "1.0.0", NAMESPACE, "10.0.0"));
    }

    @Test
    void read_a_merged_spelling_as_the_version_it_canonicalises_to() {
        // 1100 is a legal spelling of 11.0.0, not of 1.10.0: the leading group takes two digits.
        assertFalse(references(PATH + "1100", NAMESPACE, "1.10.0"));
        assertTrue(references(PATH + "1100", NAMESPACE, "11.0.0"));
    }

    @Test
    void match_a_snapshot_in_any_spelling_and_keep_it_apart_from_its_release() {
        assertTrue(references(PATH + "1-0-0-SNAPSHOT", NAMESPACE, "1.0.0-SNAPSHOT"));
        assertTrue(references(PATH + "100-SNAPSHOT", NAMESPACE, "1.0.0-SNAPSHOT"));
        assertFalse(references(PATH + "1.0.0-SNAPSHOT", NAMESPACE, "1.0.0"));
        assertFalse(references(PATH + "1.0.0", NAMESPACE, "1.0.0-SNAPSHOT"));
    }
}
