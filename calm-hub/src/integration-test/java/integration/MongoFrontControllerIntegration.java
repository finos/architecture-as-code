package integration;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoDatabase;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
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
public class MongoFrontControllerIntegration {

    private static final Logger logger = LoggerFactory.getLogger(MongoFrontControllerIntegration.class);

    @BeforeEach
    public void setup() {
        String mongoUri = ConfigProvider.getConfig().getValue("quarkus.mongodb.connection-string", String.class);
        String mongoDatabase = ConfigProvider.getConfig().getValue("quarkus.mongodb.database", String.class);

        if (mongoUri == null || mongoUri.isBlank()) {
            logger.error("MongoDB URI is not set. Check the EndToEndResource configuration.");
            throw new IllegalStateException("MongoDB URI is not set.");
        }

        try (MongoClient mongoClient = MongoClients.create(mongoUri)) {
            MongoDatabase database = mongoClient.getDatabase(mongoDatabase);

            // Ensure patterns collection exists for the create flow
            if (!database.listCollectionNames().into(new ArrayList<>()).contains("patterns")) {
                database.createCollection("patterns");
                database.getCollection("patterns").insertOne(
                        new org.bson.Document("namespace", "finos").append("patterns", new ArrayList<>())
                );
            }

            counterSetup(database);
            namespaceSetup(database);
        }
    }

    @Test
    @Order(1)
    void create_pattern_via_front_controller() {
        String payload = """
                {
                    "type": "PATTERN",
                    "json": "{\\"name\\": \\"front-controller-test\\"}"
                }
                """;

        given()
                .body(payload)
                .header("Content-Type", "application/json")
                .when().post("/calm/finos/test-pattern")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/finos/test-pattern/versions/1.0.0"));
    }

    @Test
    @Order(2)
    void get_latest_version_by_custom_id() {
        given()
                .when().get("/calm/finos/test-pattern")
                .then()
                .statusCode(200)
                .body(containsString("front-controller-test"));
    }

    @Test
    @Order(3)
    void get_specific_version_by_custom_id() {
        given()
                .when().get("/calm/finos/test-pattern/versions/1.0.0")
                .then()
                .statusCode(200)
                .body(containsString("front-controller-test"));
    }

    @Test
    @Order(4)
    void list_versions_by_custom_id() {
        given()
                .when().get("/calm/finos/test-pattern/versions")
                .then()
                .statusCode(200)
                .body("values", hasSize(1))
                .body("values[0]", equalTo("1.0.0"));
    }

    @Test
    @Order(5)
    void update_resource_with_minor_version_bump() {
        String payload = """
                {
                    "json": "{\\"name\\": \\"front-controller-test-v2\\"}",
                    "changeType": "MINOR"
                }
                """;

        given()
                .body(payload)
                .header("Content-Type", "application/json")
                .when().post("/calm/finos/test-pattern")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/finos/test-pattern/versions/1.1.0"));
    }

    @Test
    @Order(6)
    void get_latest_returns_newest_version() {
        given()
                .when().get("/calm/finos/test-pattern")
                .then()
                .statusCode(200)
                .body(containsString("front-controller-test-v2"));
    }

    @Test
    @Order(7)
    void original_version_still_accessible() {
        given()
                .when().get("/calm/finos/test-pattern/versions/1.0.0")
                .then()
                .statusCode(200)
                .body(containsString("front-controller-test"));
    }

    @Test
    @Order(8)
    void list_versions_shows_both() {
        given()
                .when().get("/calm/finos/test-pattern/versions")
                .then()
                .statusCode(200)
                .body("values", hasSize(2))
                .body("values", hasItems("1.0.0", "1.1.0"));
    }

    @Test
    @Order(9)
    void lookup_mappings_includes_created_mapping() {
        given()
                .when().get("/calm/finos/mappings?type=PATTERN")
                .then()
                .statusCode(200)
                .body("values", hasSize(greaterThanOrEqualTo(1)))
                .body("values.customId", hasItem("test-pattern"));
    }

    @Test
    @Order(10)
    void duplicate_custom_id_same_namespace_returns_update() {
        // Second POST to same customId should update (not 409), since mapping already exists
        String payload = """
                {
                    "json": "{\\"name\\": \\"front-controller-test-v3\\"}",
                    "changeType": "PATCH"
                }
                """;

        given()
                .body(payload)
                .header("Content-Type", "application/json")
                .when().post("/calm/finos/test-pattern")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/finos/test-pattern/versions/1.1.1"));
    }

    @Test
    @Order(11)
    void return_404_for_nonexistent_custom_id() {
        given()
                .when().get("/calm/finos/nonexistent-resource")
                .then()
                .statusCode(404);
    }
}
