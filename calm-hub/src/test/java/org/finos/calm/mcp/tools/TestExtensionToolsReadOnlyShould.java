package org.finos.calm.mcp.tools;

import io.quarkiverse.mcp.server.ToolManager;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import jakarta.inject.Inject;
import org.finos.calm.extensions.ExtensionTestKeys;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;

@QuarkusTest
@TestProfile(TestExtensionToolsReadOnlyShould.ReadOnlyMcpProfile.class)
class TestExtensionToolsReadOnlyShould {

    @Inject
    ToolManager toolManager;

    public static class ReadOnlyMcpProfile implements QuarkusTestProfile {
        private static final ExtensionTestKeys.KeyFiles KEYS = ExtensionTestKeys.rsaInTempDir();

        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of(
                    "calm.readonly", "true",
                    "calm.mcp.enabled", "true",
                    "calm.extensions.dir", "src/test/resources/extensions-test/mcp",
                    "calm.extensions.\"mcp-test\".backend-url", "http://localhost:8091",
                    "calm.extensions.identity.private-key-location", KEYS.privateKey().toString(),
                    "calm.extensions.identity.public-key-locations", KEYS.publicKey().toString());
        }
    }

    @Test
    void register_only_the_commands_that_a_read_only_hub_can_run() {
        assertThat(toolManager.getTool("ext_mcp-test_annotate"), notNullValue());
        assertThat(toolManager.getTool("ext_mcp-test_get-service"), notNullValue());
        assertThat(toolManager.getTool("ext_mcp-test_list-services"), notNullValue());
        assertThat(toolManager.getTool("ext_mcp-test_search"), notNullValue());
        assertThat(toolManager.getTool("ext_mcp-test_service-names"), notNullValue());
        assertThat(toolManager.getTool("ext_mcp-test_remote-search"), nullValue());
        assertThat(toolManager.getTool("ext_mcp-test_remote-output"), nullValue());
        assertThat(toolManager.getTool("ext_mcp-test_add-service"), nullValue());
        assertThat(toolManager.getTool("ext_mcp-test_remove-service"), nullValue());
    }
}
