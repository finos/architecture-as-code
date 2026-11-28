package integration;

import java.util.Map;

/** The GitHub integration fixture with MCP tools enabled. */
public class IntegrationTestGithubMcpProfile extends IntegrationTestGithubProfile {

    @Override
    public Map<String, String> getConfigOverrides() {
        return Map.of("calm.mcp.enabled", "true");
    }
}
