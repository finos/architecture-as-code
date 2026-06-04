package org.finos.calm.model;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class CalmControlTest {

    static CalmArchitecture arch;

    @BeforeAll
    static void loadFixture() throws Exception {
        ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());
        InputStream is = CalmControlTest.class.getResourceAsStream("/test-architecture.json");
        arch = CalmArchitecture.parse(new String(is.readAllBytes()), mapper);
    }

    @Test
    void node_controlParsesCorrectly() {
        CalmNode node = arch.findNodeById("payment-service").orElseThrow();
        Optional<CalmControl> ctrl = node.findControl("encryption");
        assertThat(ctrl).isPresent();
        assertThat(ctrl.get().description()).isEqualTo("Enforce TLS");
        assertThat(ctrl.get().requirements()).hasSize(1);
    }

    @Test
    void controlDetail_hasRequirementUrl() {
        CalmNode node = arch.findNodeById("payment-service").orElseThrow();
        CalmControlDetail detail = node.findControl("encryption").orElseThrow()
            .requirements().get(0);
        assertThat(detail.requirementUrl()).isEqualTo("https://example.com/requirements/tls");
        assertThat(detail.configUrl()).isEmpty();
    }
}
