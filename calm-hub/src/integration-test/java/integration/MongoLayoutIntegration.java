package integration;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.restassured.http.ContentType;
import org.bson.Document;
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
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;

@QuarkusTest
@TestProfile(IntegrationTestProfile.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class MongoLayoutIntegration {

    private static final Logger logger = LoggerFactory.getLogger(MongoLayoutIntegration.class);

    private static final String VALID_LAYOUT = """
            {
                "for": "/api/calm/namespaces/finos/architectures/5",
                "name": "Default",
                "pins": [
                    { "unique-id": "node-a", "position": { "x": 0, "y": 0 } }
                ]
            }
            """;

    private static final String UPDATED_LAYOUT = """
            {
                "for": "/api/calm/namespaces/finos/architectures/5",
                "name": "Default",
                "pins": [
                    { "unique-id": "node-a", "position": { "x": 100, "y": 200 } }
                ]
            }
            """;

    @BeforeEach
    public void setup() {
        String mongoUri = ConfigProvider.getConfig().getValue("quarkus.mongodb.connection-string", String.class);
        String mongoDatabase = ConfigProvider.getConfig().getValue("quarkus.mongodb.database", String.class);

        if (mongoUri == null || mongoUri.isBlank()) {
            logger.error("MongoDB URI is not set. Check the EndToEndResource configuration.");
            throw new IllegalStateException("MongoDB URI is not set. Check the EndToEndResource configuration.");
        }

        // Nothing to seed: MongoLayoutStore.upsertLayout's replaceOne(upsert: true) creates
        // both the "layouts" collection and its documents on first save. The old shape needed
        // an explicit seed document to upsert an array element into; the flat shape doesn't.
        try (MongoClient mongoClient = MongoClients.create(mongoUri)) {
            MongoDatabase database = mongoClient.getDatabase(mongoDatabase);
            counterSetup(database);
            namespaceSetup(database);
        }
    }

    @Test
    @Order(1)
    void end_to_end_get_with_no_layout_saved() {
        given()
                .when().get("/api/calm/namespaces/finos/architectures/5/layout")
                .then()
                .statusCode(404)
                .body(containsString("No default layout saved for architecture 5 in namespace: finos"));
    }

    @Test
    @Order(2)
    void end_to_end_save_a_layout() {
        given()
                .contentType(ContentType.JSON)
                .body(VALID_LAYOUT)
                .when().put("/api/calm/namespaces/finos/architectures/5/layout")
                .then()
                .statusCode(204);

        given()
                .when().get("/api/calm/namespaces/finos/architectures/5/layout")
                .then()
                .statusCode(200)
                .body("name", equalTo("Default"))
                .body("pins[0].position.x", equalTo(0));
    }

    @Test
    @Order(3)
    void store_the_layout_as_one_flat_document_keyed_by_namespace_and_architecture_id() {
        String mongoUri = ConfigProvider.getConfig().getValue("quarkus.mongodb.connection-string", String.class);
        String mongoDatabase = ConfigProvider.getConfig().getValue("quarkus.mongodb.database", String.class);

        // Asserts the reshape itself against real MongoDB — the API alone would pass whether
        // this were stored flat or still nested in a namespace-wide array.
        try (MongoClient mongoClient = MongoClients.create(mongoUri)) {
            MongoDatabase database = mongoClient.getDatabase(mongoDatabase);
            long matching = database.getCollection("layouts")
                    .countDocuments(Filters.and(Filters.eq("namespace", "finos"), Filters.eq("architectureId", 5)));
            assertThat(matching, is(1L));

            Document stored = database.getCollection("layouts")
                    .find(Filters.and(Filters.eq("namespace", "finos"), Filters.eq("architectureId", 5)))
                    .first();
            assertThat(stored, is(notNullValue()));
            assertThat(stored.get("layout"), is(notNullValue()));
        }
    }

    @Test
    @Order(4)
    void end_to_end_save_is_idempotent_and_overwrites_in_place() {
        given()
                .contentType(ContentType.JSON)
                .body(UPDATED_LAYOUT)
                .when().put("/api/calm/namespaces/finos/architectures/5/layout")
                .then()
                .statusCode(204);

        given()
                .when().get("/api/calm/namespaces/finos/architectures/5/layout")
                .then()
                .statusCode(200)
                .body("pins[0].position.x", equalTo(100))
                .body("pins[0].position.y", equalTo(200))
                .body("pins.size()", equalTo(1));
    }

    @Test
    @Order(5)
    void end_to_end_delete_the_layout() {
        given()
                .when().delete("/api/calm/namespaces/finos/architectures/5/layout")
                .then()
                .statusCode(204);

        given()
                .when().get("/api/calm/namespaces/finos/architectures/5/layout")
                .then()
                .statusCode(404)
                .body(containsString("No default layout saved for architecture 5 in namespace: finos"));
    }

    @Test
    @Order(6)
    void end_to_end_delete_nonexistent_layout_returns_404() {
        given()
                .when().delete("/api/calm/namespaces/finos/architectures/5/layout")
                .then()
                .statusCode(404)
                .body(containsString("No default layout saved for architecture 5 in namespace: finos"));
    }
}
