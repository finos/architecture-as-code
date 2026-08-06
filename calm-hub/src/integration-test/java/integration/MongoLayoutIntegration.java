package integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.restassured.http.ContentType;
import io.restassured.response.Response;
import org.bson.Document;
import org.eclipse.microprofile.config.ConfigProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static integration.MongoSetup.counterSetup;
import static integration.MongoSetup.namespaceSetup;
import static integration.performance.ConcurrencyTestHelper.extractIdsFromLocations;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;

/**
 * Runs in its own namespace ({@link #NAMESPACE}) rather than {@code finos}, and allocates its
 * architecture id through the API rather than assuming one. {@code EndToEndResource} is not
 * {@code restrictToAnnotatedClass}, so every {@code Mongo*Integration} class shares one
 * container and database — {@code MongoArchitectureIntegration} asserts {@code finos} has no
 * architectures at all, and counters are global sequences, so neither a shared namespace nor a
 * hardcoded id is safe here. See {@code MongoDocumentSizeLimitIntegration} for the same pattern.
 */
@QuarkusTest
@TestProfile(IntegrationTestProfile.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class MongoLayoutIntegration {

    private static final Logger logger = LoggerFactory.getLogger(MongoLayoutIntegration.class);
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final String NAMESPACE = "layout";

    private static int architectureId;

    private static String validLayout(int architectureId) {
        return """
                {
                    "for": "/api/calm/namespaces/%s/architectures/%d",
                    "name": "Default",
                    "pins": [
                        { "unique-id": "node-a", "position": { "x": 0, "y": 0 } }
                    ]
                }
                """.formatted(NAMESPACE, architectureId);
    }

    private static String updatedLayout(int architectureId) {
        return """
                {
                    "for": "/api/calm/namespaces/%s/architectures/%d",
                    "name": "Default",
                    "pins": [
                        { "unique-id": "node-a", "position": { "x": 100, "y": 200 } }
                    ]
                }
                """.formatted(NAMESPACE, architectureId);
    }

    @BeforeEach
    public void setup() throws Exception {
        String mongoUri = ConfigProvider.getConfig().getValue("quarkus.mongodb.connection-string", String.class);
        String mongoDatabase = ConfigProvider.getConfig().getValue("quarkus.mongodb.database", String.class);

        if (mongoUri == null || mongoUri.isBlank()) {
            logger.error("MongoDB URI is not set. Check the EndToEndResource configuration.");
            throw new IllegalStateException("MongoDB URI is not set. Check the EndToEndResource configuration.");
        }

        // Nothing to seed for layout itself: MongoLayoutStore.upsertLayout's replaceOne(upsert:
        // true) creates both the "layouts" collection and its documents on first save. The old
        // shape needed an explicit seed document to upsert an array element into; the flat
        // shape doesn't.
        try (MongoClient mongoClient = MongoClients.create(mongoUri)) {
            MongoDatabase database = mongoClient.getDatabase(mongoDatabase);
            counterSetup(database);
            namespaceSetup(database);

            // namespaceSetup only seeds when the namespaces collection is empty, so the
            // dedicated namespace has to be inserted on its own terms.
            if (database.getCollection("namespaces").countDocuments(new Document("name", NAMESPACE)) == 0) {
                database.getCollection("namespaces").insertOne(
                        new Document("name", NAMESPACE).append("description", "layout test namespace"));
            }
        }

        if (architectureId == 0) {
            architectureId = createArchitecture();
        }
    }

    private static int createArchitecture() throws Exception {
        Response response = given()
                .contentType(ContentType.JSON)
                .body(OBJECT_MAPPER.writeValueAsString(Map.of(
                        "name", "layout-test-architecture",
                        "description", "for layout integration tests",
                        "architectureJson", "{}")))
                .when().post("/api/calm/namespaces/" + NAMESPACE + "/architectures")
                .thenReturn();
        assertThat(response.getStatusCode(), is(201));
        return extractIdsFromLocations(List.of(response), "architectures/(\\d+)").get(0);
    }

    @Test
    @Order(1)
    void end_to_end_get_with_no_layout_saved() {
        given()
                .when().get("/api/calm/namespaces/" + NAMESPACE + "/architectures/" + architectureId + "/layout")
                .then()
                .statusCode(404)
                .body(containsString("No default layout saved for architecture " + architectureId + " in namespace: " + NAMESPACE));
    }

    @Test
    @Order(2)
    void end_to_end_reject_a_layout_for_an_architecture_that_does_not_exist() {
        int missingArchitectureId = 999999;

        given()
                .contentType(ContentType.JSON)
                .body(validLayout(missingArchitectureId))
                .when().put("/api/calm/namespaces/" + NAMESPACE + "/architectures/" + missingArchitectureId + "/layout")
                .then()
                .statusCode(404)
                .body(containsString("Architecture " + missingArchitectureId + " does not exist in namespace: " + NAMESPACE));
    }

    @Test
    @Order(3)
    void end_to_end_save_a_layout() {
        given()
                .contentType(ContentType.JSON)
                .body(validLayout(architectureId))
                .when().put("/api/calm/namespaces/" + NAMESPACE + "/architectures/" + architectureId + "/layout")
                .then()
                .statusCode(204);

        given()
                .when().get("/api/calm/namespaces/" + NAMESPACE + "/architectures/" + architectureId + "/layout")
                .then()
                .statusCode(200)
                .body("name", equalTo("Default"))
                .body("pins[0].position.x", equalTo(0));
    }

    @Test
    @Order(4)
    void store_the_layout_as_one_flat_document_keyed_by_namespace_and_architecture_id() {
        String mongoUri = ConfigProvider.getConfig().getValue("quarkus.mongodb.connection-string", String.class);
        String mongoDatabase = ConfigProvider.getConfig().getValue("quarkus.mongodb.database", String.class);

        // Asserts the reshape itself against real MongoDB — the API alone would pass whether
        // this were stored flat or still nested in a namespace-wide array.
        try (MongoClient mongoClient = MongoClients.create(mongoUri)) {
            MongoDatabase database = mongoClient.getDatabase(mongoDatabase);
            long matching = database.getCollection("layouts")
                    .countDocuments(Filters.and(Filters.eq("namespace", NAMESPACE), Filters.eq("architectureId", architectureId)));
            assertThat(matching, is(1L));

            Document stored = database.getCollection("layouts")
                    .find(Filters.and(Filters.eq("namespace", NAMESPACE), Filters.eq("architectureId", architectureId)))
                    .first();
            assertThat(stored, is(notNullValue()));
            assertThat(stored.get("layout"), is(notNullValue()));
        }
    }

    @Test
    @Order(5)
    void end_to_end_save_is_idempotent_and_overwrites_in_place() {
        given()
                .contentType(ContentType.JSON)
                .body(updatedLayout(architectureId))
                .when().put("/api/calm/namespaces/" + NAMESPACE + "/architectures/" + architectureId + "/layout")
                .then()
                .statusCode(204);

        given()
                .when().get("/api/calm/namespaces/" + NAMESPACE + "/architectures/" + architectureId + "/layout")
                .then()
                .statusCode(200)
                .body("pins[0].position.x", equalTo(100))
                .body("pins[0].position.y", equalTo(200))
                .body("pins.size()", equalTo(1));
    }
}
