package org.finos.calm.store.util;

import org.junit.jupiter.api.Test;

import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TestPatternReferenceMatcherShould {

    private static final String NAMESPACE = "finos";
    private static final String NAME = "api-gateway";
    private static final String VERSION = "1.0.0";

    private static boolean matches(String schema) {
        return Pattern.compile(PatternReferenceMatcher.referenceTo(NAMESPACE, NAME, VERSION))
                .matcher(schema).find();
    }

    @Test
    void match_a_reference_regardless_of_the_host_it_was_written_under() {
        assertTrue(matches("https://hub.corp.com/calm/namespaces/finos/patterns/api-gateway/versions/1.0.0"));
        assertTrue(matches("https://calm.example.org/calm/namespaces/finos/patterns/api-gateway/versions/1.0.0"));
        assertTrue(matches("http://localhost:8080/calm/namespaces/finos/patterns/api-gateway/versions/1.0.0"));
    }

    @Test
    void distinguish_one_version_from_another() {
        assertFalse(matches("https://hub.corp.com/calm/namespaces/finos/patterns/api-gateway/versions/2.0.0"));
    }

    @Test
    void not_match_a_pattern_whose_name_merely_starts_the_same() {
        assertFalse(matches("https://hub.corp.com/calm/namespaces/finos/patterns/api-gateway-v2/versions/1.0.0"));
    }

    @Test
    void not_match_the_same_pattern_name_in_another_namespace() {
        assertFalse(matches("https://hub.corp.com/calm/namespaces/other/patterns/api-gateway/versions/1.0.0"));
    }

    @Test
    void not_match_an_architecture_reference_of_the_same_shape() {
        assertFalse(matches("https://hub.corp.com/calm/namespaces/finos/architectures/api-gateway/versions/1.0.0"));
    }

    @Test
    void treat_a_dot_in_a_namespace_as_a_literal_rather_than_a_wildcard() {
        String expression = PatternReferenceMatcher.referenceTo("finos.calm", NAME, VERSION);
        assertTrue(Pattern.compile(expression)
                .matcher("https://h/calm/namespaces/finos.calm/patterns/api-gateway/versions/1.0.0").find());
        assertFalse(Pattern.compile(expression)
                .matcher("https://h/calm/namespaces/finosXcalm/patterns/api-gateway/versions/1.0.0").find());
    }

    @Test
    void escape_an_expression_a_caller_reaching_the_store_directly_could_otherwise_inject() {
        String expression = PatternReferenceMatcher.referenceTo(NAMESPACE, ".*", VERSION);
        assertFalse(Pattern.compile(expression)
                .matcher("https://h/calm/namespaces/finos/patterns/api-gateway/versions/1.0.0").find());
    }

    @Test
    void not_match_a_meta_schema_or_a_published_docs_url() {
        assertFalse(matches("https://calm.finos.org/release/1.2/meta/calm.json"));
        assertFalse(matches("https://calm.finos.org/getting-started/conference-signup.pattern.json"));
        assertFalse(PatternReferenceMatcher.references(null, NAMESPACE, NAME, VERSION));
    }

    @Test
    void match_every_spelling_of_the_version_the_api_accepts() {
        // rewriteId writes the requested path version into $id without canonicalising it, so a
        // stored reference can carry any of these for the same version.
        for (String spelling : new String[]{"1.0.0", "1-0-0", "1.0-0", "1-0.0", "1.00", "100"}) {
            String stored = "https://h/calm/namespaces/finos/patterns/api-gateway/versions/" + spelling;
            assertTrue(matches(stored), "database expression missed " + spelling);
            assertTrue(PatternReferenceMatcher.references(stored, NAMESPACE, NAME, VERSION),
                    "in-memory check missed " + spelling);
        }
    }

    @Test
    void match_when_the_caller_and_the_stored_reference_spell_the_version_differently() {
        String stored = "https://h/calm/namespaces/finos/patterns/api-gateway/versions/1.0.0";
        assertTrue(PatternReferenceMatcher.references(stored, NAMESPACE, NAME, "1-0-0"));
        assertTrue(Pattern.compile(PatternReferenceMatcher.referenceTo(NAMESPACE, NAME, "1-0-0"))
                .matcher(stored).find());
    }

    @Test
    void still_separate_versions_that_are_genuinely_different() {
        String stored = "https://h/calm/namespaces/finos/patterns/api-gateway/versions/1.0.0";
        assertFalse(PatternReferenceMatcher.references(stored, NAMESPACE, NAME, "1.0.1"));
        assertFalse(PatternReferenceMatcher.references(stored, NAMESPACE, NAME, "10.0.0"));
    }

    @Test
    void agree_between_the_database_side_expression_and_the_in_memory_check() {
        String hit = "https://hub.corp.com/calm/namespaces/finos/patterns/api-gateway/versions/1.0.0";
        String miss = "https://hub.corp.com/calm/namespaces/finos/patterns/api-gateway/versions/2.0.0";

        assertTrue(matches(hit));
        assertTrue(PatternReferenceMatcher.references(hit, NAMESPACE, NAME, VERSION));
        assertFalse(matches(miss));
        assertFalse(PatternReferenceMatcher.references(miss, NAMESPACE, NAME, VERSION));
    }
}
