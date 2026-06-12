package org.finos.calm.resources;

import com.fasterxml.jackson.core.JsonProcessingException;
import org.finos.calm.domain.ResourceType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Fast unit tests for {@link CalmDocumentParser} — no Quarkus container required.
 */
class TestCalmDocumentParserShould {

    private static final String BASE = "http://localhost:8080";

    private CalmDocumentParser parser;

    @BeforeEach
    void setUp() {
        parser = new CalmDocumentParser();
        parser.baseUrl = BASE;
    }

    // -------------------------------------------------------------------------
    // parseCanonicalId
    // -------------------------------------------------------------------------

    @Test
    void parse_valid_namespace_resource_id() throws JsonProcessingException {
        String json = "{\"$id\":\"http://localhost:8080/calm/namespaces/finos/patterns/api-gateway/versions/1.0.0\"}";
        CalmDocumentParser.CanonicalId id = parser.parseCanonicalId(json);
        assertEquals("finos", id.namespace());
        assertEquals(ResourceType.PATTERN, id.resourceType());
        assertEquals("patterns", id.type());
        assertEquals("api-gateway", id.name());
        assertEquals("1.0.0", id.version());
    }

    @Test
    void parse_architecture_resource_id() throws JsonProcessingException {
        String json = "{\"$id\":\"http://localhost:8080/calm/namespaces/org/architectures/my-arch/versions/2.1.0\"}";
        CalmDocumentParser.CanonicalId id = parser.parseCanonicalId(json);
        assertEquals(ResourceType.ARCHITECTURE, id.resourceType());
        assertEquals("2.1.0", id.version());
    }

    @Test
    void reject_missing_id_field() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> parser.parseCanonicalId("{\"name\":\"something\"}"));
        assertTrue(ex.getMessage().contains("$id is required"));
    }

    @Test
    void reject_blank_id_field() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> parser.parseCanonicalId("{\"$id\":\"  \"}"));
        assertTrue(ex.getMessage().contains("$id is required"));
    }

    @Test
    void reject_versionless_id() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> parser.parseCanonicalId("{\"$id\":\"http://localhost:8080/calm/namespaces/finos/patterns/api-gateway\"}"));
        assertTrue(ex.getMessage().contains("must include a version"));
    }

    @Test
    void reject_wrong_base_url() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> parser.parseCanonicalId("{\"$id\":\"https://other.host/calm/namespaces/finos/patterns/api-gateway/versions/1.0.0\"}"));
        assertTrue(ex.getMessage().contains("$id must start with"));
    }

    @Test
    void reject_reserved_name_versions() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> parser.parseCanonicalId("{\"$id\":\"http://localhost:8080/calm/namespaces/finos/patterns/versions/versions/1.0.0\"}"));
        assertTrue(ex.getMessage().contains("reserved path segment"));
    }

    @Test
    void reject_invalid_namespace_format() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> parser.parseCanonicalId("{\"$id\":\"http://localhost:8080/calm/namespaces/UPPER_CASE/patterns/api-gateway/versions/1.0.0\"}"));
        assertTrue(ex.getMessage().contains("Invalid namespace"));
    }

    @Test
    void reject_invalid_name_format() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> parser.parseCanonicalId("{\"$id\":\"http://localhost:8080/calm/namespaces/finos/patterns/123-starts-with-number/versions/1.0.0\"}"));
        assertTrue(ex.getMessage().contains("Invalid resource name"));
    }

    @Test
    void reject_unsupported_resource_type() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> parser.parseCanonicalId("{\"$id\":\"http://localhost:8080/calm/namespaces/finos/bananas/api-gateway/versions/1.0.0\"}"));
        assertTrue(ex.getMessage().contains("Unsupported resource type"));
    }

    @Test
    void normalise_trailing_slash_in_base_url() throws JsonProcessingException {
        parser.baseUrl = "http://localhost:8080/";
        CalmDocumentParser.CanonicalId id = parser.parseCanonicalId(
                "{\"$id\":\"http://localhost:8080/calm/namespaces/finos/patterns/api-gateway/versions/1.0.0\"}");
        assertEquals("finos", id.namespace());
    }

    @Test
    void reject_malformed_json() {
        assertThrows(JsonProcessingException.class,
                () -> parser.parseCanonicalId("{not valid json"));
    }

    // -------------------------------------------------------------------------
    // parseDomainControlId
    // -------------------------------------------------------------------------

    @Test
    void parse_control_requirement_id() throws JsonProcessingException {
        CalmDocumentParser.DomainControlId id = parser.parseDomainControlId(
                "{\"$id\":\"http://localhost:8080/calm/domains/security/controls/access-control/requirement/versions/1.0.0\"}");
        assertInstanceOf(CalmDocumentParser.ControlRequirementId.class, id);
        CalmDocumentParser.ControlRequirementId req = (CalmDocumentParser.ControlRequirementId) id;
        assertEquals("security", req.domain());
        assertEquals("access-control", req.controlName());
        assertEquals("1.0.0", req.version());
    }

    @Test
    void parse_control_configuration_id() throws JsonProcessingException {
        CalmDocumentParser.DomainControlId id = parser.parseDomainControlId(
                "{\"$id\":\"http://localhost:8080/calm/domains/security/controls/access-control/configurations/default-config/versions/1.0.0\"}");
        assertInstanceOf(CalmDocumentParser.ControlConfigId.class, id);
        CalmDocumentParser.ControlConfigId cfg = (CalmDocumentParser.ControlConfigId) id;
        assertEquals("security", cfg.domain());
        assertEquals("access-control", cfg.controlName());
        assertEquals("default-config", cfg.configName());
        assertEquals("1.0.0", cfg.version());
    }

    @Test
    void reject_domain_id_with_invalid_domain_slug() {
        // Domain must match [A-Za-z0-9-]+; underscores are not allowed.
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> parser.parseDomainControlId("{\"$id\":\"http://localhost:8080/calm/domains/has_underscore/controls/access-control/requirement/versions/1.0.0\"}"));
        assertTrue(ex.getMessage().contains("Invalid domain"));
    }

    @Test
    void reject_domain_id_wrong_base() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> parser.parseDomainControlId("{\"$id\":\"https://other.host/calm/domains/security/controls/access-control/requirement/versions/1.0.0\"}"));
        assertTrue(ex.getMessage().contains("$id must start with"));
    }

    // -------------------------------------------------------------------------
    // resolveAndVerify
    // -------------------------------------------------------------------------

    @Test
    void verify_matching_path_and_id() throws JsonProcessingException {
        CalmDocumentParser.VersionSpec spec = parser.resolveAndVerify(
                "{\"$id\":\"http://localhost:8080/calm/namespaces/finos/patterns/api-gateway/versions/1.0.0\"}",
                "finos", "patterns", "api-gateway", "1.0.0");
        assertEquals("1.0.0", spec.version());
        assertTrue(spec.explicit());
    }

    @Test
    void reject_id_not_matching_path_version() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> parser.resolveAndVerify(
                        "{\"$id\":\"http://localhost:8080/calm/namespaces/finos/patterns/api-gateway/versions/2.0.0\"}",
                        "finos", "patterns", "api-gateway", "1.0.0"));
        assertTrue(ex.getMessage().contains("does not match"));
    }

    @Test
    void reject_missing_id_in_resolve() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> parser.resolveAndVerify("{\"name\":\"no-id-here\"}", "finos", "patterns", "api-gateway", "1.0.0"));
        assertTrue(ex.getMessage().contains("$id is required"));
    }

    // -------------------------------------------------------------------------
    // stripId / rewriteId
    // -------------------------------------------------------------------------

    @Test
    void strip_removes_id_field() {
        String json = "{\"$id\":\"http://localhost:8080/calm/namespaces/finos/patterns/x/versions/1.0.0\",\"name\":\"x\"}";
        String stripped = parser.stripId(json);
        assertFalse(stripped.contains("$id"));
        assertTrue(stripped.contains("\"name\""));
    }

    @Test
    void strip_is_no_op_on_json_without_id() {
        String stripped = parser.stripId("{\"name\":\"x\"}");
        assertTrue(stripped.contains("\"name\""));
        assertFalse(stripped.contains("$id"));
    }

    @Test
    void rewrite_injects_versioned_id() {
        String result = parser.rewriteId("{\"name\":\"x\"}", "finos", "patterns", "api-gateway", "1.0.0");
        assertTrue(result.contains("\"$id\""));
        assertTrue(result.contains("/calm/namespaces/finos/patterns/api-gateway/versions/1.0.0"));
    }

    @Test
    void rewrite_injects_versionless_id_when_version_is_null() {
        String result = parser.rewriteId("{\"name\":\"x\"}", "finos", "patterns", "api-gateway", null);
        assertTrue(result.contains("\"$id\""));
        assertFalse(result.contains("versions"));
    }

    @Test
    void strip_then_rewrite_is_round_trip() {
        String original = "{\"$id\":\"http://localhost:8080/calm/namespaces/finos/patterns/x/versions/1.0.0\",\"name\":\"x\"}";
        String rewritten = parser.rewriteId(parser.stripId(original), "finos", "patterns", "x", "1.0.0");
        assertTrue(rewritten.contains("\"$id\":\"http://localhost:8080/calm/namespaces/finos/patterns/x/versions/1.0.0\""));
    }

    @Test
    void rewrite_strips_trailing_slash_from_base() {
        parser.baseUrl = "http://localhost:8080/";
        String result = parser.rewriteId("{\"name\":\"x\"}", "finos", "patterns", "x", "1.0.0");
        assertFalse(result.contains("//calm"));
    }

    // -------------------------------------------------------------------------
    // getLatestVersion
    // -------------------------------------------------------------------------

    @Test
    void returns_highest_semver_version() {
        assertEquals("2.0.0", parser.getLatestVersion(List.of("1.0.0", "2.0.0", "1.5.0")));
    }

    @Test
    void returns_only_element_when_single_version() {
        assertEquals("3.0.0", parser.getLatestVersion(List.of("3.0.0")));
    }

    // -------------------------------------------------------------------------
    // parseTypePlural
    // -------------------------------------------------------------------------

    @ParameterizedTest
    @ValueSource(strings = {"patterns", "architectures", "flows", "standards", "interfaces"})
    void recognises_all_supported_types(String type) {
        assertNotNull(parser.parseTypePlural(type));
    }

    @Test
    void returns_null_for_unknown_type() {
        assertNull(parser.parseTypePlural("bananas"));
    }

    @Test
    void returns_null_for_null_type() {
        assertNull(parser.parseTypePlural(null));
    }

    @Test
    void type_matching_is_case_insensitive() {
        assertEquals(ResourceType.PATTERN, parser.parseTypePlural("PATTERNS"));
    }

    // -------------------------------------------------------------------------
    // extractIdFromJson
    // -------------------------------------------------------------------------

    @Test
    void extracts_id_string_from_json() {
        assertEquals("http://example.com/thing",
                parser.extractIdFromJson("{\"$id\":\"http://example.com/thing\",\"other\":\"field\"}"));
    }

    @Test
    void returns_null_when_id_absent() {
        assertNull(parser.extractIdFromJson("{\"name\":\"x\"}"));
    }

    @Test
    void returns_null_for_invalid_json() {
        assertNull(parser.extractIdFromJson("{bad json"));
    }

    // -------------------------------------------------------------------------
    // domainPrefix
    // -------------------------------------------------------------------------

    @Test
    void domain_prefix_strips_trailing_slash() {
        parser.baseUrl = "http://localhost:8080/";
        assertEquals("http://localhost:8080/calm/domains/", parser.domainPrefix());
    }
}
