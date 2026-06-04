package org.finos.calm.model;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.io.InputStream;

import static org.assertj.core.api.Assertions.assertThat;

class CalmRelationshipTypeTest {

    static CalmArchitecture arch;

    @BeforeAll
    static void loadFixture() throws Exception {
        ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());
        InputStream is = CalmRelationshipTypeTest.class.getResourceAsStream("/test-architecture.json");
        arch = CalmArchitecture.parse(new String(is.readAllBytes()), mapper);
    }

    @Test
    void connects_parsesSourceAndDestination() {
        CalmRelationship rel = arch.getRelationships().stream()
            .filter(r -> r.uniqueId().equals("rel-connects"))
            .findFirst().orElseThrow();
        assertThat(rel.relationshipType()).isInstanceOf(CalmConnectsType.class);
        CalmConnectsType c = (CalmConnectsType) rel.relationshipType();
        assertThat(c.source().node()).isEqualTo("payment-service");
        assertThat(c.destination().node()).isEqualTo("payment-db");
    }

    @Test
    void interacts_parsesActorAndNodes() {
        CalmRelationship rel = arch.getRelationships().stream()
            .filter(r -> r.uniqueId().equals("rel-interacts"))
            .findFirst().orElseThrow();
        assertThat(rel.relationshipType()).isInstanceOf(CalmInteractsType.class);
        CalmInteractsType i = (CalmInteractsType) rel.relationshipType();
        assertThat(i.actor()).isEqualTo("customer");
        assertThat(i.nodes()).containsExactly("payment-service");
    }

    @Test
    void deployedIn_parsesContainerAndNodes() {
        CalmRelationship rel = arch.getRelationships().stream()
            .filter(r -> r.uniqueId().equals("rel-deployed-in"))
            .findFirst().orElseThrow();
        assertThat(rel.relationshipType()).isInstanceOf(CalmDeployedInType.class);
        CalmDeployedInType d = (CalmDeployedInType) rel.relationshipType();
        assertThat(d.container()).isEqualTo("k8s");
        assertThat(d.nodes()).containsExactlyInAnyOrder("payment-service", "payment-db");
    }

    @Test
    void relationshipType_isExhaustiveInSwitch() {
        for (CalmRelationship rel : arch.getRelationships()) {
            String kind = switch (rel.relationshipType()) {
                case CalmConnectsType c -> "connects";
                case CalmInteractsType i -> "interacts";
                case CalmDeployedInType d -> "deployed-in";
                case CalmComposedOfType c -> "composed-of";
                case CalmOptionsType o -> "options";
            };
            assertThat(kind).isNotNull();
        }
    }
}
