package org.finos.calm.model;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class CalmArchitectureParseTest {

    static String loadFixture() throws Exception {
        InputStream is = CalmArchitectureParseTest.class.getResourceAsStream("/test-architecture.json");
        return new String(is.readAllBytes());
    }

    @Test
    void parse_loadsExpectedCounts() throws Exception {
        CalmArchitecture arch = CalmArchitecture.parse(loadFixture());
        assertThat(arch.getNodes()).hasSize(4);
        assertThat(arch.getRelationships()).hasSize(3);
        assertThat(arch.getFlows()).hasSize(1);
    }

    @Test
    void parse_withCustomMapper_usesProvidedMapper() throws Exception {
        ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());
        CalmArchitecture arch = CalmArchitecture.parse(loadFixture(), mapper);
        assertThat(arch.getNodes()).hasSize(4);
    }

    @Test
    void getMetadata_returnsTopLevelValue() throws Exception {
        CalmArchitecture arch = CalmArchitecture.parse(loadFixture());
        assertThat(arch.getMetadata("domain")).contains("payments");
        assertThat(arch.getMetadata("owner")).contains("payments-team");
    }

    @Test
    void getMetadata_returnsEmptyForMissingKey() throws Exception {
        CalmArchitecture arch = CalmArchitecture.parse(loadFixture());
        assertThat(arch.getMetadata("no-such-key")).isEmpty();
    }

    @Test
    void parse_fromMap_loadsExpectedCounts() throws Exception {
        ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());
        Map<String, Object> map = mapper.readValue(loadFixture(), new TypeReference<>() {});
        CalmArchitecture arch = CalmArchitecture.parse(map);
        assertThat(arch.getNodes()).hasSize(4);
        assertThat(arch.getRelationships()).hasSize(3);
    }

    @Test
    void parse_fromJsonNode_loadsExpectedCounts() throws Exception {
        ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());
        JsonNode node = mapper.readTree(loadFixture());
        CalmArchitecture arch = CalmArchitecture.parse(node);
        assertThat(arch.getNodes()).hasSize(4);
        assertThat(arch.getRelationships()).hasSize(3);
    }
}
