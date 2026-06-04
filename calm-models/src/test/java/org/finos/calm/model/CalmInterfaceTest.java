package org.finos.calm.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.io.InputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CalmInterfaceTest {

    record PortInterface(@JsonProperty("port") int port, @JsonProperty("transport") String transport) {}

    static CalmArchitecture arch;

    @BeforeAll
    static void loadFixture() throws Exception {
        ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());
        InputStream is = CalmInterfaceTest.class.getResourceAsStream("/test-architecture.json");
        arch = CalmArchitecture.parse(new String(is.readAllBytes()), mapper);
    }

    @Test
    void interface_hasUniqueId() {
        CalmNode node = arch.findNodeById("payment-service").orElseThrow();
        CalmInterface iface = node.findInterface("rest-api").orElseThrow();
        assertThat(iface.uniqueId()).isEqualTo("rest-api");
    }

    @Test
    void parseAs_deserializesCustomProperties() {
        CalmNode node = arch.findNodeById("payment-service").orElseThrow();
        CalmInterface iface = node.findInterface("rest-api").orElseThrow();
        PortInterface port = iface.parseAs(PortInterface.class);
        assertThat(port.port()).isEqualTo(8443);
        assertThat(port.transport()).isEqualTo("HTTPS");
    }

    @Test
    void parseAs_throwsCalmExtensionParseException_whenMalformed() {
        CalmNode node = arch.findNodeById("payment-service").orElseThrow();
        CalmInterface iface = node.findInterface("rest-api").orElseThrow();
        assertThatThrownBy(() -> iface.parseAs(MalformedType.class))
            .isInstanceOf(CalmExtensionParseException.class);
    }

    static class MalformedType {
        @JsonProperty("port")
        public java.time.LocalDate port; // wrong type — int in JSON, LocalDate here
    }
}
