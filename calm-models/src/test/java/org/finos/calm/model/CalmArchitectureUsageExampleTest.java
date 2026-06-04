package org.finos.calm.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Demonstrates how to use calm-models to parse a CALM architecture document
 * and read properties from nodes, interfaces, metadata, and relationships.
 *
 * Use this as a reference for integrating the library into your own project.
 *
 * Maven dependency:
 *   <dependency>
 *     <groupId>org.finos.architecture-as-code</groupId>
 *     <artifactId>calm-models</artifactId>
 *     <version>1.0.0-SNAPSHOT</version>
 *   </dependency>
 */
class CalmArchitectureUsageExampleTest {

    // Define a record (or class) matching your interface schema.
    // @JsonIgnoreProperties lets you ignore fields you don't care about (e.g. "unique-id").
    @JsonIgnoreProperties(ignoreUnknown = true)
    record HttpInterface(
        @JsonProperty("port")      int    port,
        @JsonProperty("transport") String transport
    ) {}

    static CalmArchitecture arch;

    @BeforeAll
    static void loadArchitecture() throws Exception {
        InputStream is = CalmArchitectureUsageExampleTest.class.getResourceAsStream("/test-architecture.json");
        arch = CalmArchitecture.parse(new String(is.readAllBytes()));
    }

    @Test
    void findNodeByIdAndReadBasicFields() {
        CalmNode node = arch.findNodeById("payment-service").orElseThrow();
        assertThat(node.name()).isEqualTo("Payment Service");
        assertThat(node.nodeType()).isEqualTo("service");
        assertThat(node.description()).isEqualTo("Handles payment processing");
    }

    @Test
    void readInterfacePropertiesAsTypedObject() {
        CalmNode node = arch.findNodeById("payment-service").orElseThrow();

        CalmInterface iface = node.findInterface("rest-api").orElseThrow();

        // parseAs() deserializes the interface JSON into your own type.
        // The target type can map any subset of fields — unknown fields are ignored.
        HttpInterface http = iface.parseAs(HttpInterface.class);

        assertThat(http.port()).isEqualTo(8443);
        assertThat(http.transport()).isEqualTo("HTTPS");
    }

    @Test
    void readNodeMetadata() {
        CalmNode node = arch.findNodeById("payment-service").orElseThrow();

        // Single key access
        assertThat(node.getMetadata("team")).contains("payments");
        assertThat(node.getMetadata("missing-key")).isEmpty();
    }

    @Test
    void readArchitectureLevelMetadata() {
        assertThat(arch.getMetadata("domain")).contains("payments");
        assertThat(arch.getMetadata("owner")).contains("payments-team");
    }

    @Test
    void readNodeDetails() {
        CalmNode node = arch.findNodeById("payment-service").orElseThrow();

        // details holds references to a detailed architecture doc and/or required pattern
        assertThat(node.details()).isPresent();
        assertThat(node.details().get().detailedArchitecture())
            .contains("https://example.com/architectures/payment-detail.json");
        assertThat(node.details().get().requiredPattern())
            .contains("https://example.com/patterns/microservice.json");
    }

    @Test
    void findAllNodesByType() {
        List<CalmNode> services = arch.findNodesByType("service");
        assertThat(services).hasSize(1);
        assertThat(services.get(0).uniqueId()).isEqualTo("payment-service");
    }

    @Test
    void traverseGraphFromNode() {
        // getLinkedNodes returns every node connected via any relationship type
        List<CalmNode> linked = arch.getLinkedNodes("payment-service");
        List<String> ids = linked.stream().map(CalmNode::uniqueId).toList();
        assertThat(ids).containsExactlyInAnyOrder("payment-db", "customer", "k8s");
    }

    @Test
    void inspectRelationshipTypes() {
        // The sealed interface + pattern-matching switch is exhaustive —
        // the compiler rejects any switch that's missing a case.
        arch.getRelationships().forEach(rel -> {
            String summary = switch (rel.relationshipType()) {
                case CalmConnectsType  c -> c.source().node() + " → " + c.destination().node();
                case CalmInteractsType i -> i.actor() + " uses " + i.nodes();
                case CalmDeployedInType d -> d.nodes() + " deployed in " + d.container();
                case CalmComposedOfType c -> c.nodes() + " inside " + c.container();
                case CalmOptionsType   o -> o.options().size() + " options";
            };
            assertThat(summary).isNotBlank();
        });
    }

    @Test
    void readControlConfig() {
        record TlsConfig(@JsonProperty("tls-version") String tlsVersion) {}

        CalmNode node = arch.findNodeById("payment-service").orElseThrow();

        // findControl() looks up by the control ID key in the controls map
        TlsConfig config = node.findControl("encryption").orElseThrow()
            .requirements().get(0)
            .parseConfig(TlsConfig.class)
            .orElseThrow();

        assertThat(config.tlsVersion()).isEqualTo("1.3");
    }

    @Test
    void readCustomExtensionProperties() {
        record DeploymentConfig(
            @JsonProperty("region")   String region,
            @JsonProperty("replicas") int    replicas
        ) {}

        CalmNode node = arch.findNodeById("payment-service").orElseThrow();

        // parseExtension() targets a named extra property on the node —
        // any JSON property that isn't part of the base CALM node schema
        DeploymentConfig config = node.parseExtension("deployment-config", DeploymentConfig.class)
            .orElseThrow();

        assertThat(config.region()).isEqualTo("eu-west-1");
        assertThat(config.replicas()).isEqualTo(3);
    }
}
