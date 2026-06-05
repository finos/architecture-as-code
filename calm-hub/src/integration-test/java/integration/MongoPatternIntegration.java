package integration;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoDatabase;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import org.bson.Document;
import org.eclipse.microprofile.config.ConfigProvider;
import org.junit.jupiter.api.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;

import static io.restassured.RestAssured.given;
import static integration.MongoSetup.counterSetup;
import static integration.MongoSetup.namespaceSetup;
import static org.hamcrest.Matchers.*;

@QuarkusTest
@TestProfile(IntegrationTestProfile.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class MongoPatternIntegration {

    private static final Logger logger = LoggerFactory.getLogger(MongoPatternIntegration.class);
    public static final String PATTERN = "{\"name\": \"demo-pattern\"}";

    @BeforeAll
    public static void resetPatterns() {
        String mongoUri = ConfigProvider.getConfig().getValue("quarkus.mongodb.connection-string", String.class);
        String mongoDatabase = ConfigProvider.getConfig().getValue("quarkus.mongodb.database", String.class);

        try (MongoClient mongoClient = MongoClients.create(mongoUri)) {
            MongoDatabase database = mongoClient.getDatabase(mongoDatabase);

            // Drop patterns and resource_mappings to ensure clean state regardless of test ordering
            database.getCollection("patterns").drop();
            database.getCollection("resource_mappings").drop();

            // Reset pattern counter to 0
            database.getCollection("counters").updateOne(
                    new Document("_id", "patternStoreCounter"),
                    new Document("$set", new Document("sequence_value", 0))
            );
        }
    }

    @BeforeEach
    public void setupPatterns() {
        String mongoUri = ConfigProvider.getConfig().getValue("quarkus.mongodb.connection-string", String.class);
        String mongoDatabase = ConfigProvider.getConfig().getValue("quarkus.mongodb.database", String.class);

        // Safeguard: Fail fast if URI is not set
        if (mongoUri == null || mongoUri.isBlank()) {
            logger.error("MongoDB URI is not set. Check the EndToEndResource configuration.");
            throw new IllegalStateException("MongoDB URI is not set. Check the EndToEndResource configuration.");
        }

        try (MongoClient mongoClient = MongoClients.create(mongoUri)) {
            MongoDatabase database = mongoClient.getDatabase(mongoDatabase);

            if (!database.listCollectionNames().into(new ArrayList<>()).contains("patterns")) {
                database.createCollection("patterns");
                database.getCollection("patterns").insertOne(
                        new Document("namespace", "finos").append("patterns", new ArrayList<>())
                );
            }

            counterSetup(database);
            namespaceSetup(database);
        }
    }

    @Test
    @Order(1)
    void end_to_end_get_with_no_patterns() {
        given()
                .when().get("/calm/namespaces/finos/patterns")
                .then()
                .statusCode(200)
                .body("values", empty());
    }

    @Test
    @Order(2)
    void end_to_end_create_a_pattern() {
        String payload = """
                {
                     "name": "name",
                     "description": "description",
                     "patternJson": "{\\"name\\": \\"demo-pattern\\"}"
                }
                """;

        given()
                .body(payload)
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/patterns")
                .then()
                .statusCode(201)
                .header("Location", containsString("calm/namespaces/finos/patterns/1"));
    }

    @Test
    @Order(3)
    void end_to_end_verify_versions() {
        given()
                .when().get("/calm/namespaces/finos/patterns/1/versions")
                .then()
                .statusCode(200)
                .body("values", hasSize(1))
                .body("values[0]", equalTo("1.0.0"));
    }

    @Test
    @Order(4)
    void end_to_end_verify_pattern() {
        given()
                .when().get("/calm/namespaces/finos/patterns/1/versions/1.0.0")
                .then()
                .statusCode(200)
                .body(equalTo(PATTERN));
    }

    // --- Wrapper name/description sync from JSON body on new version ---

    @Test
    @Order(5)
    void end_to_end_list_patterns_returns_wrapper_name_and_description_from_create() {
        given()
                .when().get("/calm/namespaces/finos/patterns")
                .then()
                .statusCode(200)
                .body("values", hasSize(1))
                .body("values[0].name", equalTo("name"))
                .body("values[0].description", equalTo("description"));
    }

    @Test
    @Order(6)
    void end_to_end_create_pattern_version_with_name_and_description_in_envelope() {
        String versionBody = "{\"name\": \"updated-pattern\", \"description\": \"updated pattern description\", \"patternJson\": \"{\\\"nodes\\\": []}\"}";

        given()
                .body(versionBody)
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/patterns/1/versions/2.0.0")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/patterns/1/versions/2.0.0"));
    }

    @Test
    @Order(7)
    void end_to_end_list_patterns_reflects_updated_name_and_description_after_new_version() {
        given()
                .when().get("/calm/namespaces/finos/patterns")
                .then()
                .statusCode(200)
                .body("values", hasSize(1))
                .body("values[0].name", equalTo("updated-pattern"))
                .body("values[0].description", equalTo("updated pattern description"));
    }

    @Test
    @Order(8)
    void end_to_end_create_pattern_version_stores_only_inner_patternJson_and_updates_wrapper() {
        String inner = "{\"nodes\": [], \"relationships\": []}";
        String envelope = "{\"name\": \"third-name\", \"description\": \"third description\", \"patternJson\": \"" + inner.replace("\"", "\\\"") + "\"}";

        given()
                .body(envelope)
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/patterns/1/versions/3.0.0")
                .then()
                .statusCode(201);

        // Stored content must be the inner patternJson verbatim, not the envelope
        given()
                .when().get("/calm/namespaces/finos/patterns/1/versions/3.0.0")
                .then()
                .statusCode(200)
                .body(equalTo(inner));

        // Wrapper reflects the latest envelope name/description
        given()
                .when().get("/calm/namespaces/finos/patterns")
                .then()
                .statusCode(200)
                .body("values[0].name", equalTo("third-name"))
                .body("values[0].description", equalTo("third description"));
    }

    @Test
    @Order(9)
    void end_to_end_reject_malformed_json_on_versioned_post() {
        String envelope = "{\"name\": \"n\", \"description\": \"d\", \"patternJson\": \"{ not json\"}";

        given()
                .body(envelope)
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/patterns/1/versions/9.0.0")
                .then()
                .statusCode(400)
                .body(containsString("could not be parsed"));
    }

    @Test
    @Order(10)
    void end_to_end_reject_malformed_json_on_versioned_put() {
        String envelope = "{\"name\": \"n\", \"description\": \"d\", \"patternJson\": \"{ not json\"}";

        given()
                .body(envelope)
                .header("Content-Type", "application/json")
                .when().put("/calm/namespaces/finos/patterns/1/versions/1.0.0")
                .then()
                .statusCode(400)
                .body(containsString("could not be parsed"));
    }
}
