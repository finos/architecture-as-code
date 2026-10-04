package integration;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoDatabase;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import org.eclipse.microprofile.config.ConfigProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import static io.restassured.RestAssured.given;
import static integration.MongoSetup.counterSetup;
import static integration.MongoSetup.namespaceSetup;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;

/**
 * End-to-end lifecycle for a {@code -SNAPSHOT} version, exercised against a real MongoDB
 * (TestContainers) rather than mocked stores. Promotion is a create-then-delete sequence
 * across two separate store operations with no transaction, and {@code versionCount}
 * bookkeeping spans a header document and version documents — a mocked test cannot catch a
 * failure in either half of that sequence.
 *
 * <p>Uses the shared Mongo container and the "finos" namespace already seeded by
 * {@link MongoSetup#namespaceSetup}, like every other Mongo*Integration test — the
 * "lifecycle" custom ID is unique to this class, so it does not collide with resources
 * created by the other suites sharing that container.</p>
 */
@QuarkusTest
@TestProfile(IntegrationTestProfile.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class SnapshotLifecycleIntegration {

    private static final Logger logger = LoggerFactory.getLogger(SnapshotLifecycleIntegration.class);

    // MappingControllerResource is mounted at "/calm" with no "/api" prefix (that prefix
    // belongs to the separate numeric-ID resources such as ArchitectureResource).
    private static final String PATH_BASE = "/calm/namespaces/finos/architectures/lifecycle";

    // The $id must equal the full canonical URL, including the base URL that
    // IntegrationTestProfile configures via calm.hub.base-url — otherwise
    // CalmDocumentParser.resolveAndVerify rejects the request with 400.
    private static final String ID_BASE = "http://localhost:8080" + PATH_BASE;

    // Same idempotent setup as every other Mongo*Integration class sharing this container —
    // required because test-class execution order across the suite is not guaranteed, and
    // this class does not otherwise touch the counters/namespaces collections that other
    // classes' @BeforeEach primes.
    @BeforeEach
    void setup() {
        String mongoUri = ConfigProvider.getConfig().getValue("quarkus.mongodb.connection-string", String.class);
        String mongoDatabase = ConfigProvider.getConfig().getValue("quarkus.mongodb.database", String.class);

        if (mongoUri == null || mongoUri.isBlank()) {
            logger.error("MongoDB URI is not set. Check the EndToEndResource configuration.");
            throw new IllegalStateException("MongoDB URI is not set. Check the EndToEndResource configuration.");
        }

        try (MongoClient mongoClient = MongoClients.create(mongoUri)) {
            MongoDatabase database = mongoClient.getDatabase(mongoDatabase);
            counterSetup(database);
            namespaceSetup(database);
        }
    }

    @Test
    @Order(1)
    void create_the_resource_at_a_snapshot() {
        given()
            .contentType("application/json")
            .body(document("1.0.0-SNAPSHOT", "first"))
        .when()
            .post(PATH_BASE + "/versions/1.0.0-SNAPSHOT")
        .then()
            .statusCode(201);
    }

    @Test
    @Order(2)
    void overwrite_the_snapshot_and_read_the_new_content_back() {
        given()
            .contentType("application/json")
            .body(document("1.0.0-SNAPSHOT", "second"))
        .when()
            .post(PATH_BASE + "/versions/1.0.0-SNAPSHOT")
        .then()
            .statusCode(200);

        given()
        .when()
            .get(PATH_BASE + "/versions/1.0.0-SNAPSHOT")
        .then()
            .statusCode(200)
            .body("title", equalTo("second"));
    }

    @Test
    @Order(3)
    void list_the_snapshot_as_the_only_version() {
        given()
        .when()
            .get(PATH_BASE + "/versions")
        .then()
            .statusCode(200)
            .body("values", contains("1.0.0-SNAPSHOT"));
    }

    @Test
    @Order(4)
    void publish_the_release_and_lose_the_snapshot() {
        given()
            .contentType("application/json")
            .body(document("1.0.0", "published"))
        .when()
            .post(PATH_BASE + "/versions/1.0.0")
        .then()
            .statusCode(201);

        given()
        .when()
            .get(PATH_BASE + "/versions/1.0.0-SNAPSHOT")
        .then()
            .statusCode(404);

        given()
        .when()
            .get(PATH_BASE + "/versions")
        .then()
            .statusCode(200)
            .body("values", hasItem("1.0.0"))
            .body("values", not(hasItem("1.0.0-SNAPSHOT")));
    }

    @Test
    @Order(5)
    void refuse_a_snapshot_that_shadows_the_published_release() {
        given()
            .contentType("application/json")
            .body(document("1.0.0-SNAPSHOT", "shadow"))
        .when()
            .post(PATH_BASE + "/versions/1.0.0-SNAPSHOT")
        .then()
            .statusCode(409);
    }

    @Test
    @Order(6)
    void return_a_snapshot_from_search() {
        // The spec decides snapshots are searchable: they are real documents in the
        // namespace, and filtering work in progress out of results is a UI concern, not a
        // storage one.
        //
        // GroupedSearchResults/SearchResult (org.finos.calm.domain.search) carry no version
        // field at all — search matches and returns namespace/id/name/description, grouped
        // by type ("architectures", "patterns", ... — not a flat "values" array), and the
        // endpoint's query parameter is "q", not "query". MongoSearchStore matches against
        // the resource's header, whose name/description are denormalized from the most
        // recently written version's title/description (see
        // MongoArchitectureStore#updateHeaderDetails) — so posting this snapshot makes the
        // *resource* (not a specific version) discoverable by the snapshot's title.
        given()
            .contentType("application/json")
            .body(document("2.0.0-SNAPSHOT", "searchable-snapshot"))
        .when()
            .post(PATH_BASE + "/versions/2.0.0-SNAPSHOT")
        .then()
            .statusCode(201);

        given()
            .queryParam("q", "searchable-snapshot")
        .when()
            .get("/calm/search")
        .then()
            .statusCode(200)
            .body("architectures.name", hasItem("searchable-snapshot"));
    }

    private String document(String version, String title) {
        return """
                {
                  "$id": "%s/versions/%s",
                  "title": "%s",
                  "nodes": [],
                  "relationships": []
                }
                """.formatted(ID_BASE, version, title);
    }
}
