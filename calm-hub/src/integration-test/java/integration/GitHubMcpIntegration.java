package integration;

import io.quarkiverse.mcp.server.TextContent;
import io.quarkiverse.mcp.server.ToolResponse;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.security.TestSecurity;
import jakarta.inject.Inject;
import org.finos.calm.mcp.tools.ArchitectureTools;
import org.finos.calm.store.github.registry.ResourceRegistry;
import org.finos.calm.store.github.sync.GitHubCloneManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.Set;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;

/** Proves that a stem from a GitHub-mode listing can be used as an MCP tool id. */
@QuarkusTest
@TestProfile(IntegrationTestGithubMcpProfile.class)
class GitHubMcpIntegration {

    @Inject
    ArchitectureTools architectureTools;

    @Inject
    GitHubCloneManager cloneManager;

    @Inject
    ResourceRegistry registryService;

    @BeforeEach
    void waitForInitialClone() {
        Instant deadline = Instant.now().plus(Duration.ofSeconds(30));
        while (!registryService.getSnapshot().getNamespaces().containsAll(Set.of("finos"))) {
            if (Instant.now().isAfter(deadline)) {
                throw new IllegalStateException("Repository clone did not become ready");
            }
            try {
                Thread.sleep(50);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new RuntimeException(e);
            }
        }
    }

    @Test
    @TestSecurity(user = "alice", roles = "group1")
    void list_architectures_then_read_versions_with_the_stem() {
        ToolResponse listing = architectureTools.listArchitectures("finos");
        assertThat(text(listing), containsString("ID: api"));

        ToolResponse versions = architectureTools.listArchitectureVersions("finos", "api", null, null);
        assertThat(text(versions), containsString(cloneManager.headSha("finos")));
    }

    private static String text(ToolResponse response) {
        return ((TextContent) response.firstContent()).text();
    }
}
