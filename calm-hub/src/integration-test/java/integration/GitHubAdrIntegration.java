package integration;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.security.TestSecurity;
import jakarta.inject.Inject;
import org.finos.calm.store.github.registry.ResourceRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Set;

import static io.restassured.RestAssured.given;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.endsWith;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.matchesPattern;

/**
 * The name-based ADR routes over a GitHub-backed namespace. The fixture repo holds one
 * kebab-case ADR whose slug comes from its file name and one camelCase ADR that declares
 * its own slug.
 */
@QuarkusTest
@TestProfile(IntegrationTestGithubProfile.class)
class GitHubAdrIntegration {

    private static final String SHA_PATTERN = "[0-9a-f]{7,40}";

    @Inject
    ResourceRegistry registryService;

    @BeforeEach
    void waitForInitialClone() throws InterruptedException {
        Instant deadline = Instant.now().plus(Duration.ofSeconds(30));
        while (!registryService.getSnapshot().getNamespaces().containsAll(Set.of("finos", "other"))) {
            if (Instant.now().isAfter(deadline)) {
                throw new IllegalStateException("Registry was not populated within 30s");
            }
            Thread.sleep(50);
        }
    }

    @Test
    @TestSecurity(user = "alice", roles = "group1")
    void list_adrs_by_slug() {
        given().when().get("/calm/namespaces/finos/adrs")
                .then().statusCode(200)
                .body("values.customId", containsInAnyOrder("use-oauth2", "event-streaming"))
                .body("values.resourceType", containsInAnyOrder("ADR", "ADR"));
    }

    @Test
    @TestSecurity(user = "alice", roles = "group1")
    void serve_the_latest_adr_by_slug_with_a_commit_sha_as_its_version() {
        String id = given().when().get("/calm/namespaces/finos/adrs/use-oauth2")
                .then().statusCode(200)
                .body("title", equalTo("Use OAuth2"))
                .body("status", equalTo("accepted"))
                .body("decision-outcome.chosen-option", equalTo("OAuth2"))
                .extract().jsonPath().getString("$id");

        List<String> versions = given().when().get("/calm/namespaces/finos/adrs/use-oauth2/versions")
                .then().statusCode(200)
                .body("values", hasSize(1))
                .extract().jsonPath().getList("values", String.class);
        assertThat(versions.get(0), matchesPattern(SHA_PATTERN));
        assertThat(id, endsWith("/calm/namespaces/finos/adrs/use-oauth2/versions/" + versions.get(0)));

        given().when().get("/calm/namespaces/finos/adrs/use-oauth2/versions/" + versions.get(0))
                .then().statusCode(200).body("title", equalTo("Use OAuth2"));
        given().when().get("/calm/namespaces/finos/adrs/use-oauth2/versions/1")
                .then().statusCode(200).body("title", equalTo("Use OAuth2"));
    }

    @Test
    @TestSecurity(user = "alice", roles = "group1")
    void serve_a_camel_case_adr_by_its_declared_slug() {
        given().when().get("/calm/namespaces/finos/adrs/event-streaming")
                .then().statusCode(200)
                .body("slug", equalTo("event-streaming"))
                .body("context-and-problem-statement", equalTo("We need events"));
    }

    @Test
    @TestSecurity(user = "alice", roles = "group1")
    void return_404_for_an_unknown_slug_or_revision() {
        given().when().get("/calm/namespaces/finos/adrs/missing").then().statusCode(404);
        given().when().get("/calm/namespaces/finos/adrs/use-oauth2/versions/2").then().statusCode(404);
    }

    @Test
    @TestSecurity(user = "alice", roles = "group1")
    void serve_adrs_through_the_numeric_storage_api() {
        int id = given().when().get("/api/calm/namespaces/finos/adrs")
                .then().statusCode(200)
                .body("values.slug", containsInAnyOrder("use-oauth2", "event-streaming"))
                .extract().jsonPath().getInt("values.find { it.slug == 'use-oauth2' }.id");

        given().when().get("/api/calm/namespaces/finos/adrs/" + id)
                .then().statusCode(200)
                .body("slug", equalTo("use-oauth2"))
                .body("adr.title", equalTo("Use OAuth2"));
        given().when().get("/api/calm/namespaces/finos/adrs/" + id + "/revisions")
                .then().statusCode(200).body("values", equalTo(List.of(1)));
    }

    @Test
    @TestSecurity(user = "alice", roles = "group1")
    void include_adrs_in_search() {
        given().when().get("/calm/search?q=oauth2")
                .then().statusCode(200)
                .body("adrs.namespace", hasItem("finos"));
    }
}
