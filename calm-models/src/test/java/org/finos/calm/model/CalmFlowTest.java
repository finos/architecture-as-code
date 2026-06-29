package org.finos.calm.model;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.io.InputStream;

import static org.assertj.core.api.Assertions.assertThat;

class CalmFlowTest {

    static CalmArchitecture arch;

    @BeforeAll
    static void loadFixture() throws Exception {
        ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());
        InputStream is = CalmFlowTest.class.getResourceAsStream("/test-architecture.json");
        arch = CalmArchitecture.parse(new String(is.readAllBytes()), mapper);
    }

    @Test
    void flow_hasCorrectBasicFields() {
        assertThat(arch.getFlows()).hasSize(1);
        CalmFlow flow = arch.getFlows().get(0);
        assertThat(flow.uniqueId()).isEqualTo("flow-payment");
        assertThat(flow.name()).isEqualTo("Process Payment");
        assertThat(flow.description()).isEqualTo("Payment processing flow");
        assertThat(flow.requirementUrl()).contains("https://example.com/requirements/payment-flow");
    }

    @Test
    void flow_hasCorrectTransitions() {
        CalmFlow flow = arch.getFlows().get(0);
        assertThat(flow.transitions()).hasSize(2);

        CalmFlowTransition first = flow.transitions().get(0);
        assertThat(first.relationshipUniqueId()).isEqualTo("rel-interacts");
        assertThat(first.sequenceNumber()).isEqualTo(1);
        assertThat(first.direction()).isEqualTo(FlowDirection.SOURCE_TO_DESTINATION);
    }
}
