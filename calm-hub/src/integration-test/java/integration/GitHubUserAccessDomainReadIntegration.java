package integration;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.security.TestSecurity;
import jakarta.inject.Inject;
import org.finos.calm.store.github.sync.GitHubCloneManager;
import org.finos.calm.store.github.registry.ResourceRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.Set;

import static io.restassured.RestAssured.given;

/**
 * End-to-end proof, against real local git repos (no mocking of GitHubUserAccessStore,
 * GitHubCloneManager, or ResourceRegistry) that the DOMAIN_READ grants
 * GitHubUserAccessStore derives actually gate the {@code /api/calm/domains/{domain}/controls}
 * endpoint correctly - both that a domain within an accessible namespace is readable,
 * and that a domain that only exists in a namespace the caller cannot access is not
 * (this is the exact "any grant unlocks everything" shape slice 4's review reverted,
 * so it matters that this is scoped correctly rather than just present).
 *
 * <p>See {@link GitHubFixtureResource} for the fixture repos this relies on: namespace
 * "finos" (access group "group1") contains a control under domain "security"; namespace
 * "other" (access group "group2") contains one under domain "finance". alice only has
 * role "group1".
 */
@QuarkusTest
@TestProfile(IntegrationTestGithubProfile.class)
class GitHubUserAccessDomainReadIntegration {

    @Inject
    GitHubCloneManager cloneManager;

    @Inject
    ResourceRegistry registryService;

    private static final Set<String> EXPECTED_NAMESPACES = Set.of("finos", "other");

    @BeforeEach
    void waitForInitialClone() {
        // GitHubCloneManager.cloneAll() sets state=READY on its own last line, but
        // registryService.rebuild(...) - the step that actually populates the registry
        // these assertions read from - runs AFTER cloneAll() returns, in
        // GitHubStartupInitializer.cloneAndRebuild(). Polling getState() alone leaves a
        // window where a request lands with state=READY but an empty (or partial)
        // registry, so poll the registry's own contents instead - the same ordering
        // gap noted against the readiness-gate bucket-C item.
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
    void allow_a_namespace_scoped_read_for_a_user_with_a_matching_access_group() {
        given()
                .when().get("/api/calm/namespaces/finos/architectures")
                .then()
                .statusCode(200);
    }

    @Test
    @TestSecurity(user = "alice", roles = "group1")
    void allow_domain_read_for_a_domain_the_users_accessible_namespace_actually_contains() {
        given()
                .when().get("/api/calm/domains/security/controls")
                .then()
                .statusCode(200)
                .body("values[0].name", org.hamcrest.Matchers.notNullValue());
    }

    @Test
    @TestSecurity(user = "alice", roles = "group1")
    void read_a_control_requirements_content_through_the_domain_route_with_namespace_distinct_from_domain() {
        // "finos" (the namespace this control actually lives in) and "security" (the
        // domain it's addressed by) are deliberately different strings here - the exact
        // conflation TestGitHubControlStoreShould's fixtures used to hide. Proves the
        // domain-scoped route resolves real content end to end, not just a non-empty list.
        int controlId = given()
                .when().get("/api/calm/domains/security/controls")
                .then()
                .statusCode(200)
                .extract().jsonPath().getInt("values[0].id");

        given()
                .when().get("/api/calm/domains/security/controls/" + controlId + "/requirement/versions")
                .then()
                .statusCode(200)
                .body("values", org.hamcrest.Matchers.not(org.hamcrest.Matchers.empty()));

        String sha = given()
                .when().get("/api/calm/domains/security/controls/" + controlId + "/requirement/versions")
                .then()
                .statusCode(200)
                .extract().jsonPath().getString("values[0]");

        given()
                .when().get("/api/calm/domains/security/controls/" + controlId + "/requirement/versions/" + sha)
                .then()
                .statusCode(200)
                .body(org.hamcrest.Matchers.equalTo("{}"));
    }

    @Test
    @TestSecurity(user = "alice", roles = "group1")
    void deny_domain_read_for_a_domain_that_only_exists_outside_every_namespace_the_user_can_access() {
        given()
                .when().get("/api/calm/domains/finance/controls")
                .then()
                .statusCode(403);
    }

    @Test
    void deny_an_unauthenticated_request() {
        given()
                .when().get("/api/calm/namespaces/finos/architectures")
                .then()
                .statusCode(401);
    }
}
