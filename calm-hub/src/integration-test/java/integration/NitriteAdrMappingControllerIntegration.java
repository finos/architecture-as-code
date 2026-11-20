package integration;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.restassured.RestAssured;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.concurrent.CompletableFuture;

import static io.restassured.RestAssured.given;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.endsWith;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItems;
import static org.hamcrest.Matchers.is;

/**
 * The name-based ADR endpoints against NitriteDB. Slug uniqueness here rests on
 * {@code NitriteAdrStore}'s lock, since migrations (and so the unique index) do not run
 * under {@code @QuarkusTest}.
 */
@QuarkusTest
@TestProfile(NitriteIntegrationTestProfile.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class NitriteAdrMappingControllerIntegration {

    private static final String NAMESPACE = "adr-names";
    private static final String BASE = "/calm/namespaces/" + NAMESPACE + "/adrs";
    private static final String DOCUMENT = """
            {
              "title": "Use OAuth 2.0",
              "context-and-problem-statement": "We need auth",
              "requesters": ["alice"],
              "considered-options": [{"name": "OAuth2", "description": "Standard"}, {"name": "Basic", "description": "Simple"}],
              "decision-outcome": {"chosen-option": "OAuth2", "rationale": "Widely used"}
            }
            """;

    @BeforeEach
    void setup() {
        NitriteSetup.namespaceSetup(NAMESPACE, "ADR name-based tests");
    }

    @Test
    @Order(1)
    void create_an_adr_with_a_slug_derived_from_the_title() {
        given().header("Content-Type", "application/json").body(DOCUMENT)
                .when().post(BASE)
                .then().statusCode(201)
                .header("Location", endsWith(BASE + "/use-oauth-2-0/versions/1"))
                .body("$id", equalTo("http://localhost:8080" + BASE + "/use-oauth-2-0/versions/1"))
                .body("slug", equalTo("use-oauth-2-0"))
                .body("status", equalTo("draft"))
                .body("requesters", equalTo(List.of("alice")))
                .body("decision-outcome.chosen-option", equalTo("OAuth2"));
    }

    @Test
    @Order(2)
    void suffix_the_slug_of_a_second_adr_with_the_same_title() {
        given().header("Content-Type", "application/json").body(DOCUMENT)
                .when().post(BASE)
                .then().statusCode(201)
                .header("Location", endsWith(BASE + "/use-oauth-2-0-2/versions/1"));
    }

    @Test
    @Order(3)
    void refuse_a_requested_slug_that_is_taken() {
        given().header("Content-Type", "application/json")
                .body(DOCUMENT.replaceFirst("\\{", "{\"slug\": \"use-oauth-2-0\","))
                .when().post(BASE)
                .then().statusCode(409);
    }

    @Test
    @Order(4)
    void list_adrs_by_slug() {
        given().when().get(BASE)
                .then().statusCode(200)
                .body("values.customId", hasItems("use-oauth-2-0", "use-oauth-2-0-2"))
                .body("values[0].resourceType", equalTo("ADR"));
    }

    @Test
    @Order(5)
    void add_a_revision_that_sets_the_status() {
        given().header("Content-Type", "application/json")
                .body(DOCUMENT.replaceFirst("\\{", "{\"status\": \"accepted\", \"slug\": \"use-oauth-2-0\","))
                .when().post(BASE + "/use-oauth-2-0")
                .then().statusCode(201)
                .header("Location", endsWith(BASE + "/use-oauth-2-0/versions/2"))
                .body("status", equalTo("accepted"));

        given().when().get(BASE + "/use-oauth-2-0/versions")
                .then().statusCode(200).body("values", equalTo(List.of("1", "2")));
        given().when().get(BASE + "/use-oauth-2-0/versions/1")
                .then().statusCode(200).body("status", equalTo("draft"));
        given().when().get(BASE + "/use-oauth-2-0")
                .then().statusCode(200)
                .body("status", equalTo("accepted"))
                .body("$id", endsWith("/use-oauth-2-0/versions/2"));
    }

    @Test
    @Order(6)
    void keep_the_slug_on_the_numeric_storage_api() {
        int id = given().when().get("/api/calm/namespaces/" + NAMESPACE + "/adrs")
                .then().statusCode(200)
                .extract().jsonPath().getInt("values.find { it.slug == 'use-oauth-2-0' }.id");

        given().when().get("/api/calm/namespaces/" + NAMESPACE + "/adrs/" + id)
                .then().statusCode(200)
                .body("slug", equalTo("use-oauth-2-0"))
                .body("adr.status", equalTo("accepted"));
    }

    @Test
    @Order(7)
    void reject_invalid_documents_and_unknown_addresses() {
        given().header("Content-Type", "application/json")
                .body(DOCUMENT.replace("\"chosen-option\": \"OAuth2\"", "\"chosen-option\": \"Kerberos\""))
                .when().post(BASE)
                .then().statusCode(400).body(containsString("chosen-option Kerberos"));
        given().header("Content-Type", "application/json").body("{\"title\": \"T\"}")
                .when().post(BASE)
                .then().statusCode(400).body(containsString("context-and-problem-statement is required"));
        given().when().get(BASE + "/missing").then().statusCode(404);
        given().when().get(BASE + "/use-oauth-2-0/versions/99").then().statusCode(404);
        given().when().get("/calm/namespaces/no-such-namespace/adrs/use-oauth-2-0").then().statusCode(404);
        given().header("Content-Type", "application/json")
                .body("{\"$id\": \"http://localhost:8080" + BASE + "/use-oauth-2-0/versions/3\", \"title\": \"T\"}")
                .when().post("/calm")
                .then().statusCode(400).body(containsString("POST /calm/namespaces/{namespace}/adrs"));
    }

    @Test
    @Order(8)
    void give_concurrent_creates_of_the_same_title_distinct_slugs() {
        int writers = 8;
        HttpClient http = HttpClient.newHttpClient();
        String body = DOCUMENT.replace("Use OAuth 2.0", "Concurrent Choice");
        URI uri = URI.create(RestAssured.baseURI + ":" + RestAssured.port + BASE);
        List<CompletableFuture<HttpResponse<String>>> responses = new ArrayList<>();
        for (int i = 0; i < writers; i++) {
            responses.add(http.sendAsync(HttpRequest.newBuilder(uri)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString()));
        }

        HashSet<String> locations = new HashSet<>();
        for (CompletableFuture<HttpResponse<String>> response : responses) {
            HttpResponse<String> result = response.join();
            assertThat(result.body(), result.statusCode(), is(201));
            locations.add(result.headers().firstValue("Location").orElseThrow());
        }
        assertThat(locations.size(), is(writers));
    }
}
