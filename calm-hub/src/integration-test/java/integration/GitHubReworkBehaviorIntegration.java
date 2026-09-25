package integration;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.security.TestSecurity;
import jakarta.inject.Inject;
import org.finos.calm.store.github.registry.ResourceRegistry;
import org.finos.calm.store.github.sync.GitHubCloneManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Set;

import static io.restassured.RestAssured.given;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.matchesPattern;
import static org.hamcrest.Matchers.not;

/**
 * End-to-end proof, against the same real local git repos as
 * {@link GitHubUserAccessDomainReadIntegration} (no mocking of any GitHub store or registry
 * class), of four behaviours this rework changed and that a unit test alone can't fully
 * verify because they depend on real clone/registry wiring:
 *
 * <ul>
 *   <li>a {@code building-blocks/} file classifies as its own {@code BUILDING_BLOCK} type -
 *       restored (PR #3066 review discussion, byrash, 2026-09-24) after having been aliased
 *       to {@code Standard} (#3052); reachable only through the generic front controller
 *       ({@link org.finos.calm.resources.MappingControllerResource}), since there is no
 *       dedicated resource for it</li>
 *   <li>a version list never contains the literal {@code "latest"} - it's either a real SHA
 *       or the clone's current HEAD SHA (Phase 3/5)</li>
 *   <li>{@code GET .../versions/latest} is rejected with 400 by the shared validation regex,
 *       in GitHub mode exactly as in every other storage mode (Phase 3)</li>
 *   <li>the namespace-scoped {@code controls} route returns 400 "Unsupported resource type",
 *       not the 500 it returned before the Phase 2 revert (the domain-scoped route - the
 *       correct one - is proven separately in {@link GitHubUserAccessDomainReadIntegration})
 *       </li>
 * </ul>
 */
@QuarkusTest
@TestProfile(IntegrationTestGithubProfile.class)
class GitHubReworkBehaviorIntegration {

    @Inject
    GitHubCloneManager cloneManager;

    @Inject
    ResourceRegistry registryService;

    private static final Set<String> EXPECTED_NAMESPACES = Set.of("finos", "other");
    private static final String SHA_PATTERN = "[0-9a-f]{7,40}";

    @BeforeEach
    void waitForInitialClone() {
        // See GitHubUserAccessDomainReadIntegration.waitForInitialClone for why this polls
        // the registry's contents rather than just GitHubCloneManager.getState().
        Instant deadline = Instant.now().plus(Duration.ofSeconds(30));
        while (!registryService.getSnapshot().getNamespaces().containsAll(EXPECTED_NAMESPACES)) {
            if (Instant.now().isAfter(deadline)) {
                throw new IllegalStateException(
                        "Registry did not contain " + EXPECTED_NAMESPACES + " within 30s - clone state: "
                                + cloneManager.getState() + ", namespaces seen: "
                                + registryService.getSnapshot().getNamespaces());
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
    void classify_a_building_blocks_file_as_a_building_block() {
        given()
                .when().get("/calm/namespaces/finos/building-blocks")
                .then()
                .statusCode(200)
                .body("values.customId", hasItem("rate-limit-policy"));
    }

    @Test
    @TestSecurity(user = "alice", roles = "group1")
    void never_return_the_literal_latest_in_a_version_list_and_return_a_real_sha_instead() {
        List<String> versions = given()
                .when().get("/calm/namespaces/finos/building-blocks/rate-limit-policy/versions")
                .then()
                .statusCode(200)
                .extract().jsonPath().getList("values", String.class);

        assertThat(versions, not(hasItem("latest")));
        assertThat(versions, everyItem(matchesPattern(SHA_PATTERN)));
    }

    @Test
    @TestSecurity(user = "alice", roles = "group1")
    void reject_the_latest_version_alias_with_a_400_in_github_mode_too() {
        given()
                .when().get("/calm/namespaces/finos/building-blocks/rate-limit-policy/versions/latest")
                .then()
                .statusCode(400);
    }

    @Test
    @TestSecurity(user = "alice", roles = "group1")
    void reject_the_namespace_scoped_controls_route_with_a_400_not_a_500() {
        given()
                .when().get("/calm/namespaces/finos/controls/access-control/versions")
                .then()
                .statusCode(400)
                .body(org.hamcrest.Matchers.containsString("Unsupported resource type"));
    }
}
