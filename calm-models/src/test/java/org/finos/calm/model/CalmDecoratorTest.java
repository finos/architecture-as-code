package org.finos.calm.model;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.finos.calm.model.canonical.CalmDecoratorSchema;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CalmDecoratorTest {

    static final String MINIMAL_DECORATOR = """
            {
              "unique-id": "minimal-deployment",
              "type": "deployment",
              "target": ["example-architecture.json"],
              "applies-to": ["web-service"],
              "data": {"status": "pending"}
            }
            """;

    static final ObjectMapper mapper = new ObjectMapper();

    static String decorator;

    @BeforeAll
    static void loadFixture() throws Exception {
        try (InputStream is = CalmDecoratorTest.class.getResourceAsStream("/test-decorator.json")) {
            decorator = new String(is.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    @Test
    void parse_loadsEveryProperty() {
        CalmDecorator parsed = CalmDecorator.parse(decorator);
        assertThat(parsed.schema()).contains("https://calm.finos.org/standards/deployment/1.0/deployment.decorator.standard.json");
        assertThat(parsed.uniqueId()).isEqualTo("simple-deployment-example");
        assertThat(parsed.type()).isEqualTo("deployment");
        assertThat(parsed.targetType()).containsExactly("architecture");
        assertThat(parsed.target()).containsExactly("example-architecture.json");
        assertThat(parsed.appliesTo()).containsExactly("web-service");
        assertThat(parsed.data())
                .containsEntry("status", "completed")
                .containsEntry("start-time", "2026-02-23T10:00:00Z")
                .hasSize(5);
    }

    @Test
    void parse_optionalPropertiesEmptyWhenMissing() {
        CalmDecorator parsed = CalmDecorator.parse(MINIMAL_DECORATOR);
        assertThat(parsed.schema()).isEmpty();
        assertThat(parsed.targetType()).isEmpty();
    }

    @Test
    void parse_keepsNullDataValues() throws Exception {
        Map<String, Object> map = mapper.readValue(MINIMAL_DECORATOR, new TypeReference<>() {});
        map.put("data", Collections.singletonMap("end-time", null));
        assertThat(CalmDecorator.parse(map).data()).containsEntry("end-time", null);
    }

    @Test
    void parse_withCustomMapper_usesProvidedMapper() {
        CalmDecorator parsed = CalmDecorator.parse(decorator, new ObjectMapper());
        assertThat(parsed.uniqueId()).isEqualTo("simple-deployment-example");
    }

    @Test
    void parse_fromMap_matchesParseFromJson() throws Exception {
        Map<String, Object> map = mapper.readValue(decorator, new TypeReference<>() {});
        assertThat(CalmDecorator.parse(map)).isEqualTo(CalmDecorator.parse(decorator));
    }

    @Test
    void parse_fromJsonNode_matchesParseFromJson() throws Exception {
        JsonNode node = mapper.readTree(decorator);
        assertThat(CalmDecorator.parse(node)).isEqualTo(CalmDecorator.parse(decorator));
    }

    @Test
    void parse_throwsWhenJsonIsMalformed() {
        assertThatThrownBy(() -> CalmDecorator.parse("{"))
                .isInstanceOf(RuntimeException.class)
                .hasMessage("Failed to parse CALM decorator JSON");
    }

    @Test
    void parse_throwsWhenDataIsNotAnObject() throws Exception {
        Map<String, Object> map = mapper.readValue(MINIMAL_DECORATOR, new TypeReference<>() {});
        map.put("data", "not-an-object");
        assertThatThrownBy(() -> CalmDecorator.parse(map))
                .isInstanceOf(RuntimeException.class)
                .hasMessage("Failed to parse CALM decorator from object");
    }

    @Test
    void schema_roundTripsEveryProperty() throws Exception {
        assertRoundTrips(decorator);
    }

    @Test
    void schema_roundTripsWithoutOptionalProperties() throws Exception {
        assertRoundTrips(MINIMAL_DECORATOR);
    }

    private static void assertRoundTrips(String json) throws Exception {
        CalmDecoratorSchema schema = mapper.readValue(json, CalmDecoratorSchema.class);
        JsonNode written = mapper.valueToTree(schema);
        assertThat(written).isEqualTo(mapper.readTree(json));
    }
}
