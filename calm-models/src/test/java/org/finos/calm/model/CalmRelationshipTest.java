package org.finos.calm.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.io.InputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CalmRelationshipTest {

    static CalmArchitecture arch;

    @BeforeAll
    static void loadFixture() throws Exception {
        ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());
        InputStream is = CalmRelationshipTest.class.getResourceAsStream("/test-architecture.json");
        arch = CalmArchitecture.parse(new String(is.readAllBytes()), mapper);
    }

    @Test
    void relationship_hasUniqueIdAndDescription() {
        CalmRelationship rel = arch.getRelationships().stream()
            .filter(r -> r.uniqueId().equals("rel-connects"))
            .findFirst().orElseThrow();
        assertThat(rel.uniqueId()).isEqualTo("rel-connects");
        assertThat(rel.description()).contains("Service writes to DB");
    }

    @Test
    void relationship_hasProtocolEnum() {
        CalmRelationship rel = arch.getRelationships().stream()
            .filter(r -> r.uniqueId().equals("rel-connects"))
            .findFirst().orElseThrow();
        assertThat(rel.protocol()).contains(CalmProtocol.JDBC);
    }

    @Test
    void relationship_withoutProtocol_returnsEmpty() {
        CalmRelationship rel = arch.getRelationships().stream()
            .filter(r -> r.uniqueId().equals("rel-deployed-in"))
            .findFirst().orElseThrow();
        assertThat(rel.protocol()).isEmpty();
    }

    @Test
    void parseExtension_returnsTypedObject_whenPresent() {
        record Sla(@JsonProperty("max-latency-ms") int maxLatencyMs,
                   @JsonProperty("availability") String availability) {}

        CalmRelationship rel = arch.getRelationships().stream()
            .filter(r -> r.uniqueId().equals("rel-connects"))
            .findFirst().orElseThrow();

        Sla sla = rel.parseExtension("sla", Sla.class).orElseThrow();
        assertThat(sla.maxLatencyMs()).isEqualTo(50);
        assertThat(sla.availability()).isEqualTo("99.9%");
    }

    @Test
    void parseExtension_returnsEmpty_whenAbsent() {
        CalmRelationship rel = arch.getRelationships().stream()
            .filter(r -> r.uniqueId().equals("rel-connects"))
            .findFirst().orElseThrow();
        assertThat(rel.parseExtension("no-such-extension", String.class)).isEmpty();
    }

    @Test
    void parseExtension_throwsCalmExtensionParseException_whenMalformed() {
        record Bad(@JsonProperty("max-latency-ms") java.time.LocalDate maxLatencyMs) {}

        CalmRelationship rel = arch.getRelationships().stream()
            .filter(r -> r.uniqueId().equals("rel-connects"))
            .findFirst().orElseThrow();

        assertThatThrownBy(() -> rel.parseExtension("sla", Bad.class))
            .isInstanceOf(CalmExtensionParseException.class);
    }

    @Test
    void relationship_withNoExtensions_returnsEmptyForAnyKey() {
        CalmRelationship rel = arch.getRelationships().stream()
            .filter(r -> r.uniqueId().equals("rel-deployed-in"))
            .findFirst().orElseThrow();
        assertThat(rel.parseExtension("sla", Object.class)).isEmpty();
    }
}
