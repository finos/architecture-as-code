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
import static org.hamcrest.Matchers.is;

@QuarkusTest
@TestProfile(TestExtensionToolsMcpDisabledShould.McpDisabledProfile.class)
class TestExtensionToolsMcpDisabledShould {

    @Inject
    ToolManager toolManager;

    public static class McpDisabledProfile implements QuarkusTestProfile {
        private static final ExtensionTestKeys.KeyFiles KEYS = ExtensionTestKeys.rsaInTempDir();

        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of(
                    "calm.mcp.enabled", "false",
                    "calm.extensions.dir", "src/test/resources/extensions-test/mcp",
                    "calm.extensions.\"mcp-test\".backend-url", "http://localhost:8091",
                    "calm.extensions.identity.private-key-location", KEYS.privateKey().toString(),
                    "calm.extensions.identity.public-key-locations", KEYS.publicKey().toString());
        }
    }

    @Test
    void start_and_register_no_command_tools() {
        boolean anyCommandTool = false;
        for (ToolManager.ToolInfo tool : toolManager) {
            anyCommandTool |= tool.name().startsWith("ext_");
        }
        assertThat(anyCommandTool, is(false));
    }
}
