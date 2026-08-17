package org.finos.calm.store.github.util;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.nio.file.Path;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;

class TestCalmContentDetectorShould {

    private CalmContentDetector detector;

    @BeforeEach
    void setup() {
        detector = new CalmContentDetector();
    }

    @Test
    void detect_architecture_from_nodes_array_in_architectures_directory() {
        String json = "{\"nodes\": [], \"relationships\": []}";
        CalmResourceType type = detector.detect(json, Path.of("architectures/payment.json"));
        assertThat(type, equalTo(CalmResourceType.ARCHITECTURE));
    }

    @Test
    void detect_pattern_from_nodes_array_in_patterns_directory() {
        String json = "{\"nodes\": [], \"relationships\": []}";
        CalmResourceType type = detector.detect(json, Path.of("patterns/microservices.json"));
        assertThat(type, equalTo(CalmResourceType.PATTERN));
    }

    @Test
    void return_unknown_when_nodes_present_but_unknown_directory() {
        String json = "{\"nodes\": [{\"unique-id\": \"svc\"}]}";
        CalmResourceType type = detector.detect(json, Path.of("misc/something.json"));
        assertThat(type, equalTo(CalmResourceType.UNKNOWN));
    }

    @Test
    void detect_timeline_from_moments_array() {
        String json = "{\"moments\": [{\"date\": \"2026-01-01\"}]}";
        CalmResourceType type = detector.detect(json, Path.of("timelines/roadmap.json"));
        assertThat(type, equalTo(CalmResourceType.TIMELINE));
    }

    @Test
    void detect_timeline_from_schema_url() {
        String json = "{\"$schema\": \"https://calm.finos.org/draft/2026-03/meta/calm-timeline.json\"}";
        CalmResourceType type = detector.detect(json, Path.of("any/thing.json"));
        assertThat(type, equalTo(CalmResourceType.TIMELINE));
    }

    @Test
    void detect_flow_from_schema_url() {
        String json = "{\"$schema\": \"https://calm.finos.org/draft/2026-03/meta/flow.json\"}";
        CalmResourceType type = detector.detect(json, Path.of("flows/checkout.json"));
        assertThat(type, equalTo(CalmResourceType.FLOW));
    }

    @Test
    void detect_interface_from_schema_url() {
        String json = "{\"$schema\": \"https://calm.finos.org/release/1.2/meta/interface.json\"}";
        CalmResourceType type = detector.detect(json, Path.of("interfaces/api.json"));
        assertThat(type, equalTo(CalmResourceType.INTERFACE));
    }

    @Test
    void detect_control_from_schema_url() {
        String json = "{\"$schema\": \"https://calm.finos.org/release/1.2/meta/control.json\"}";
        CalmResourceType type = detector.detect(json, Path.of("controls/security/tls.json"));
        assertThat(type, equalTo(CalmResourceType.CONTROL));
    }

    @Test
    void detect_decorator_from_schema_url() {
        String json = "{\"$schema\": \"https://calm.finos.org/release/1.2/meta/decorators.json\"}";
        CalmResourceType type = detector.detect(json, Path.of("decorators/governance.json"));
        assertThat(type, equalTo(CalmResourceType.DECORATOR));
    }

    @Test
    void detect_standard_from_directory_only() {
        String json = "{\"title\": \"API Design Standard\"}";
        CalmResourceType type = detector.detect(json, Path.of("standards/api-design.json"));
        assertThat(type, equalTo(CalmResourceType.STANDARD));
    }

    @Test
    void detect_guideline_from_directory_only() {
        String json = "{\"title\": \"Microservices Guideline\"}";
        CalmResourceType type = detector.detect(json, Path.of("guidelines/microservices.json"));
        assertThat(type, equalTo(CalmResourceType.GUIDELINE));
    }

    @Test
    void detect_adr_from_directory_only() {
        String json = "{\"status\": \"accepted\", \"context\": \"we need X\"}";
        CalmResourceType type = detector.detect(json, Path.of("adrs/0001-use-kafka.json"));
        assertThat(type, equalTo(CalmResourceType.ADR));
    }

    @Test
    void detect_control_from_directory_convention() {
        String json = "{\"requirement\": \"must use TLS\"}";
        CalmResourceType type = detector.detect(json, Path.of("controls/tls-policy.json"));
        assertThat(type, equalTo(CalmResourceType.CONTROL));
    }

    @Test
    void return_unknown_for_null_content() {
        CalmResourceType type = detector.detect(null, Path.of("test.json"));
        assertThat(type, equalTo(CalmResourceType.UNKNOWN));
    }

    @Test
    void return_unknown_for_blank_content() {
        CalmResourceType type = detector.detect("  ", Path.of("test.json"));
        assertThat(type, equalTo(CalmResourceType.UNKNOWN));
    }

    @Test
    void return_unknown_for_invalid_json() {
        CalmResourceType type = detector.detect("not json at all", Path.of("test.json"));
        assertThat(type, equalTo(CalmResourceType.UNKNOWN));
    }

    @Test
    void return_unknown_for_unrecognized_content_in_unknown_directory() {
        String json = "{\"foo\": \"bar\"}";
        CalmResourceType type = detector.detect(json, Path.of("random/stuff.json"));
        assertThat(type, equalTo(CalmResourceType.UNKNOWN));
    }

    @Test
    void handle_null_file_path_gracefully() {
        String json = "{\"nodes\": []}";
        CalmResourceType type = detector.detect(json, null);
        assertThat(type, equalTo(CalmResourceType.UNKNOWN));
    }

    @Test
    void detect_pattern_from_nodes_in_patterns_directory_with_nested_path() {
        String json = "{\"nodes\": [{\"unique-id\": \"svc\"}], \"relationships\": []}";
        CalmResourceType type = detector.detect(json, Path.of("patterns/sub/event-driven.json"));
        assertThat(type, equalTo(CalmResourceType.PATTERN));
    }

    @Test
    void detect_flow_from_directory_when_no_schema() {
        String json = "{\"steps\": [{\"from\": \"a\", \"to\": \"b\"}]}";
        CalmResourceType type = detector.detect(json, Path.of("flows/checkout-flow.json"));
        assertThat(type, equalTo(CalmResourceType.FLOW));
    }

    @Test
    void detect_interface_from_directory_only() {
        String json = "{\"endpoints\": []}";
        CalmResourceType type = detector.detect(json, Path.of("interfaces/payment-api.json"));
        assertThat(type, equalTo(CalmResourceType.INTERFACE));
    }

    @Test
    void detect_decorator_from_directory_only() {
        String json = "{\"type\": \"governance\"}";
        CalmResourceType type = detector.detect(json, Path.of("decorators/aigf.json"));
        assertThat(type, equalTo(CalmResourceType.DECORATOR));
    }

    @Test
    void detect_timeline_from_directory_only_without_moments() {
        String json = "{\"entries\": []}";
        CalmResourceType type = detector.detect(json, Path.of("timelines/roadmap.json"));
        assertThat(type, equalTo(CalmResourceType.TIMELINE));
    }

    @Test
    void prefer_content_signal_over_directory_for_timeline() {
        String json = "{\"moments\": [{\"date\": \"2026-01-01\"}]}";
        CalmResourceType type = detector.detect(json, Path.of("architectures/misplaced.json"));
        assertThat(type, equalTo(CalmResourceType.TIMELINE));
    }

    @Test
    void detect_from_relationships_array_alone() {
        String json = "{\"relationships\": [{\"unique-id\": \"rel-1\"}]}";
        CalmResourceType type = detector.detect(json, Path.of("architectures/conn.json"));
        assertThat(type, equalTo(CalmResourceType.ARCHITECTURE));
    }

    @Test
    void detect_flow_from_schema_without_directory_hint() {
        String json = "{\"$schema\": \"https://calm.finos.org/release/1.2/meta/flow.json\"}";
        CalmResourceType type = detector.detect(json, Path.of("misc/some-flow.json"));
        assertThat(type, equalTo(CalmResourceType.FLOW));
    }

    @Test
    void detect_interface_from_schema_without_directory_hint() {
        String json = "{\"$schema\": \"https://calm.finos.org/release/1.2/meta/interface.json\"}";
        CalmResourceType type = detector.detect(json, Path.of("misc/api.json"));
        assertThat(type, equalTo(CalmResourceType.INTERFACE));
    }

    @Test
    void detect_control_from_schema_without_directory_hint() {
        String json = "{\"$schema\": \"https://calm.finos.org/release/1.2/meta/control.json\"}";
        CalmResourceType type = detector.detect(json, Path.of("misc/tls.json"));
        assertThat(type, equalTo(CalmResourceType.CONTROL));
    }

    @Test
    void detect_decorator_from_schema_without_directory_hint() {
        String json = "{\"$schema\": \"https://calm.finos.org/release/1.2/meta/decorators.json\"}";
        CalmResourceType type = detector.detect(json, Path.of("misc/gov.json"));
        assertThat(type, equalTo(CalmResourceType.DECORATOR));
    }

    @Test
    void return_unknown_when_schema_does_not_match_any_keyword() {
        String json = "{\"$schema\": \"https://example.com/unknown-schema.json\"}";
        CalmResourceType type = detector.detect(json, Path.of("misc/thing.json"));
        assertThat(type, equalTo(CalmResourceType.UNKNOWN));
    }

    @Test
    void detect_standard_from_nodes_in_standards_directory() {
        String json = "{\"nodes\": [], \"relationships\": []}";
        CalmResourceType type = detector.detect(json, Path.of("standards/api-design.json"));
        assertThat(type, equalTo(CalmResourceType.STANDARD));
    }

    @Test
    void detect_guideline_from_nodes_in_guidelines_directory() {
        String json = "{\"nodes\": []}";
        CalmResourceType type = detector.detect(json, Path.of("guidelines/best.json"));
        assertThat(type, equalTo(CalmResourceType.GUIDELINE));
    }

    @Test
    void detect_adr_from_nodes_in_adrs_directory() {
        String json = "{\"nodes\": []}";
        CalmResourceType type = detector.detect(json, Path.of("adrs/0001.json"));
        assertThat(type, equalTo(CalmResourceType.ADR));
    }
}
