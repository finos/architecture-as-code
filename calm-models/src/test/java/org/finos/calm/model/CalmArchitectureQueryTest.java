package org.finos.calm.model;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CalmArchitectureQueryTest {

    static CalmArchitecture arch;

    @BeforeAll
    static void loadFixture() throws Exception {
        ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());
        InputStream is = CalmArchitectureQueryTest.class.getResourceAsStream("/test-architecture.json");
        arch = CalmArchitecture.parse(new String(is.readAllBytes()), mapper);
    }

    @Test
    void findNodeById_returnsNode() {
        assertThat(arch.findNodeById("payment-service")).isPresent();
        assertThat(arch.findNodeById("payment-service").get().name()).isEqualTo("Payment Service");
    }

    @Test
    void findNodeById_returnsEmptyWhenMissing() {
        assertThat(arch.findNodeById("no-such-node")).isEmpty();
    }

    @Test
    void findNodesByType_filtersCorrectly() {
        List<CalmNode> services = arch.findNodesByType("service");
        assertThat(services).hasSize(1);
        assertThat(services.get(0).uniqueId()).isEqualTo("payment-service");
    }

    @Test
    void getRelationships_nodeId_returnsAllRelationshipsInvolvingNode() {
        // payment-service appears in rel-connects (source), rel-interacts (node), rel-deployed-in (node)
        List<CalmRelationship> rels = arch.getRelationships("payment-service");
        assertThat(rels).hasSize(3);
    }

    @Test
    void getRelationships_nodeId_returnsRelationshipsWhenNodeIsContainer() {
        // k8s is the container in rel-deployed-in
        List<CalmRelationship> rels = arch.getRelationships("k8s");
        assertThat(rels).hasSize(1);
        assertThat(rels.get(0).uniqueId()).isEqualTo("rel-deployed-in");
    }

    @Test
    void getLinkedNodes_returnsConnectedNodes() {
        List<CalmNode> linked = arch.getLinkedNodes("payment-service");
        List<String> ids = linked.stream().map(CalmNode::uniqueId).toList();
        assertThat(ids).containsExactlyInAnyOrder("payment-db", "customer", "k8s");
    }

    @Test
    void getLinkedNodes_returnsLinkedNodesFromDestination() {
        List<CalmNode> linked = arch.getLinkedNodes("payment-db");
        List<String> ids = linked.stream().map(CalmNode::uniqueId).toList();
        assertThat(ids).containsExactlyInAnyOrder("payment-service", "k8s");
    }
}
