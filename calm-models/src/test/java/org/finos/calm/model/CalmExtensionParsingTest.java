package org.finos.calm.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.io.InputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CalmExtensionParsingTest {

    record DeploymentConfig(
        @JsonProperty("region") String region,
        @JsonProperty("replicas") int replicas
    ) {}

    record NodeMetadata(
        @JsonProperty("team") String team,
        @JsonProperty("tier") int tier
    ) {}

    record ArchMetadata(
        @JsonProperty("domain") String domain,
        @JsonProperty("owner") String owner
    ) {}

    record TlsConfig(@JsonProperty("tls-version") String tlsVersion) {}

    static CalmArchitecture arch;

    @BeforeAll
    static void loadFixture() throws Exception {
        ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());
        InputStream is = CalmExtensionParsingTest.class.getResourceAsStream("/test-architecture.json");
        arch = CalmArchitecture.parse(new String(is.readAllBytes()), mapper);
    }

    @Test
    void parseExtension_returnsTypedObject_whenPresent() {
        CalmNode node = arch.findNodeById("payment-service").orElseThrow();
        DeploymentConfig config = node.parseExtension("deployment-config", DeploymentConfig.class)
            .orElseThrow();
        assertThat(config.region()).isEqualTo("eu-west-1");
        assertThat(config.replicas()).isEqualTo(3);
    }

    @Test
    void parseExtension_returnsEmpty_whenAbsent() {
        CalmNode node = arch.findNodeById("payment-service").orElseThrow();
        assertThat(node.parseExtension("no-such-extension", DeploymentConfig.class)).isEmpty();
    }

    @Test
    void parseExtension_throwsCalmExtensionParseException_whenMalformed() {
        CalmNode node = arch.findNodeById("payment-service").orElseThrow();
        assertThatThrownBy(() -> node.parseExtension("deployment-config", MalformedExtension.class))
            .isInstanceOf(CalmExtensionParseException.class);
    }

    static class MalformedExtension {
        @JsonProperty("region") public java.time.LocalDate region; // wrong type
    }

    @Test
    void parseMetadata_node_returnsTypedObject() {
        CalmNode node = arch.findNodeById("payment-service").orElseThrow();
        NodeMetadata meta = node.parseMetadata(NodeMetadata.class).orElseThrow();
        assertThat(meta.team()).isEqualTo("payments");
        assertThat(meta.tier()).isEqualTo(1);
    }

    @Test
    void parseMetadata_node_returnsEmpty_whenNodeHasNoMetadata() {
        CalmNode node = arch.findNodeById("payment-db").orElseThrow();
        assertThat(node.parseMetadata(NodeMetadata.class)).isEmpty();
    }

    @Test
    void getMetadata_node_returnsIndividualKey() {
        CalmNode node = arch.findNodeById("payment-service").orElseThrow();
        assertThat(node.getMetadata("team")).contains("payments");
        assertThat(node.getMetadata("missing")).isEmpty();
    }

    @Test
    void parseMetadata_arch_returnsTypedObject() {
        ArchMetadata meta = arch.parseMetadata(ArchMetadata.class).orElseThrow();
        assertThat(meta.domain()).isEqualTo("payments");
        assertThat(meta.owner()).isEqualTo("payments-team");
    }

    @Test
    void parseAs_interface_returnsTypedObject() {
        record PortInterface(@JsonProperty("port") int port, @JsonProperty("transport") String transport) {}
        CalmNode node = arch.findNodeById("payment-service").orElseThrow();
        CalmInterface iface = node.findInterface("rest-api").orElseThrow();
        PortInterface port = iface.parseAs(PortInterface.class);
        assertThat(port.port()).isEqualTo(8443);
        assertThat(port.transport()).isEqualTo("HTTPS");
    }

    @Test
    void parseConfig_controlDetail_returnsTypedObject() {
        CalmNode node = arch.findNodeById("payment-service").orElseThrow();
        CalmControlDetail detail = node.findControl("encryption").orElseThrow()
            .requirements().get(0);
        TlsConfig config = detail.parseConfig(TlsConfig.class).orElseThrow();
        assertThat(config.tlsVersion()).isEqualTo("1.3");
    }

    @Test
    void parseConfig_controlDetail_configUrl_isEmpty() {
        CalmNode node = arch.findNodeById("payment-service").orElseThrow();
        CalmControlDetail detail = node.findControl("encryption").orElseThrow()
            .requirements().get(0);
        assertThat(detail.configUrl()).isEmpty();
        assertThat(detail.parseConfig(TlsConfig.class)).isPresent();
    }
}
