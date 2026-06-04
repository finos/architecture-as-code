package org.finos.calm.model;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.io.InputStream;

import static org.assertj.core.api.Assertions.assertThat;

class CalmNodeTest {

    static CalmArchitecture arch;

    @BeforeAll
    static void loadFixture() throws Exception {
        ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());
        InputStream is = CalmNodeTest.class.getResourceAsStream("/test-architecture.json");
        arch = CalmArchitecture.parse(new String(is.readAllBytes()), mapper);
    }

    @Test
    void node_hasCorrectBasicFields() {
        CalmNode node = arch.findNodeById("payment-service").orElseThrow();
        assertThat(node.uniqueId()).isEqualTo("payment-service");
        assertThat(node.nodeType()).isEqualTo("service");
        assertThat(node.name()).isEqualTo("Payment Service");
        assertThat(node.description()).isEqualTo("Handles payment processing");
    }

    @Test
    void node_hasDetails() {
        CalmNode node = arch.findNodeById("payment-service").orElseThrow();
        assertThat(node.details()).isPresent();
        assertThat(node.details().get().detailedArchitecture())
            .contains("https://example.com/architectures/payment-detail.json");
        assertThat(node.details().get().requiredPattern())
            .contains("https://example.com/patterns/microservice.json");
    }

    @Test
    void node_findInterface_returnsPresent() {
        CalmNode node = arch.findNodeById("payment-service").orElseThrow();
        assertThat(node.findInterface("rest-api")).isPresent();
    }

    @Test
    void node_findInterface_returnsEmptyWhenMissing() {
        CalmNode node = arch.findNodeById("payment-service").orElseThrow();
        assertThat(node.findInterface("no-such-interface")).isEmpty();
    }

    @Test
    void node_findControl_returnsPresent() {
        CalmNode node = arch.findNodeById("payment-service").orElseThrow();
        assertThat(node.findControl("encryption")).isPresent();
    }

    @Test
    void node_withoutOptionalFields_parsesCleanly() {
        CalmNode node = arch.findNodeById("payment-db").orElseThrow();
        assertThat(node.details()).isEmpty();
        assertThat(node.interfaces()).isEmpty();
        assertThat(node.controls()).isEmpty();
    }
}
