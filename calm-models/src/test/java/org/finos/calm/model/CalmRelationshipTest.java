package org.finos.calm.model;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.io.InputStream;

import static org.assertj.core.api.Assertions.assertThat;

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
}
