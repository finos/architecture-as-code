package integration;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.UpdateOptions;
import com.mongodb.client.model.Updates;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import org.bson.Document;
import org.eclipse.microprofile.config.ConfigProvider;
import org.finos.calm.domain.controls.CreateControlRequirement;
import org.junit.jupiter.api.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;

import static integration.MongoSetup.counterSetup;
import static integration.MongoSetup.domainSetup;
import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
@TestProfile(IntegrationTestProfile.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class MongoControlIntegration {

    private static final Logger logger = LoggerFactory.getLogger(MongoControlIntegration.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final String VALID_DOMAIN = "security";
    private static final String INVALID_DOMAIN = "nonexistent";

    @BeforeEach
    public void setupControls() {
        String mongoUri = ConfigProvider.getConfig().getValue("quarkus.mongodb.connection-string", String.class);
        String mongoDatabase = ConfigProvider.getConfig().getValue("quarkus.mongodb.database", String.class);

        if (mongoUri == null || mongoUri.isBlank()) {
            logger.error("MongoDB URI is not set. Check the EndToEndResource configuration.");
            throw new IllegalStateException("MongoDB URI is not set. Check the EndToEndResource configuration.");
        }

        try (MongoClient mongoClient = MongoClients.create(mongoUri)) {
            MongoDatabase database = mongoClient.getDatabase(mongoDatabase);
            domainSetup(database);
            counterSetup(database);
        }
    }

    @Test
    @Order(1)
    void end_to_end_get_controls_returns_empty_for_valid_domain() {
        given()
                .when().get("/calm/domains/" + VALID_DOMAIN + "/controls")
                .then()
                .statusCode(200)
                .body("values", empty());
    }

    @Test
    @Order(2)
    void end_to_end_get_controls_returns_404_for_invalid_domain() {
        given()
                .when().get("/calm/domains/" + INVALID_DOMAIN + "/controls")
                .then()
                .statusCode(404);
    }

    @Test
    @Order(3)
    void end_to_end_create_control_for_valid_domain() throws JsonProcessingException {
        CreateControlRequirement request = new CreateControlRequirement(
                "Access Control", "Ensure proper access control mechanisms", "{\"type\": \"requirement\"}");

        given()
                .body(objectMapper.writeValueAsString(request))
                .header("Content-Type", "application/json")
                .when().post("/calm/domains/" + VALID_DOMAIN + "/controls")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/domains/" + VALID_DOMAIN + "/controls/"))
                .body("name", equalTo("Access Control"))
                .body("description", equalTo("Ensure proper access control mechanisms"));
    }

    @Test
    @Order(4)
    void end_to_end_get_controls_returns_created_control() {
        given()
                .when().get("/calm/domains/" + VALID_DOMAIN + "/controls")
                .then()
                .statusCode(200)
                .body("values", hasSize(1))
                .body("values[0].name", equalTo("Access Control"))
                .body("values[0].description", equalTo("Ensure proper access control mechanisms"));
    }

    @Test
    @Order(5)
    void end_to_end_create_control_returns_404_for_invalid_domain() throws JsonProcessingException {
        CreateControlRequirement request = new CreateControlRequirement(
                "Test Control", "Test Description", "{}");

        given()
                .body(objectMapper.writeValueAsString(request))
                .header("Content-Type", "application/json")
                .when().post("/calm/domains/" + INVALID_DOMAIN + "/controls")
                .then()
                .statusCode(404);
    }

    @Test
    @Order(6)
    void end_to_end_create_second_control_for_same_domain() throws JsonProcessingException {
        CreateControlRequirement request = new CreateControlRequirement(
                "Encryption", "Ensure data is encrypted at rest and in transit", "{\"type\": \"requirement\"}");

        given()
                .body(objectMapper.writeValueAsString(request))
                .header("Content-Type", "application/json")
                .when().post("/calm/domains/" + VALID_DOMAIN + "/controls")
                .then()
                .statusCode(201)
                .body("name", equalTo("Encryption"))
                .body("description", equalTo("Ensure data is encrypted at rest and in transit"));
    }

    @Test
    @Order(7)
    void end_to_end_get_controls_returns_both_controls() {
        given()
                .when().get("/calm/domains/" + VALID_DOMAIN + "/controls")
                .then()
                .statusCode(200)
                .body("values", hasSize(2));
    }

    // --- Requirement Version Endpoints ---

    @Test
    @Order(8)
    void end_to_end_get_requirement_versions_for_created_control() {
        // Control 1 was created with requirement JSON, so should have version 1.0.0
        given()
                .when().get("/calm/domains/" + VALID_DOMAIN + "/controls/1/requirement/versions")
                .then()
                .statusCode(200)
                .body("values", hasSize(1))
                .body("values[0]", equalTo("1.0.0"));
    }

    @Test
    @Order(9)
    void end_to_end_get_requirement_at_version() {
        given()
                .when().get("/calm/domains/" + VALID_DOMAIN + "/controls/1/requirement/versions/1.0.0")
                .then()
                .statusCode(200)
                .body("type", equalTo("requirement"));
    }

    @Test
    @Order(10)
    void end_to_end_get_requirement_versions_returns_404_for_invalid_control() {
        given()
                .when().get("/calm/domains/" + VALID_DOMAIN + "/controls/999/requirement/versions")
                .then()
                .statusCode(404);
    }

    @Test
    @Order(11)
    void end_to_end_get_requirement_version_returns_404_for_invalid_version() {
        given()
                .when().get("/calm/domains/" + VALID_DOMAIN + "/controls/1/requirement/versions/9.9.9")
                .then()
                .statusCode(404);
    }

    @Test
    @Order(12)
    void end_to_end_get_requirement_versions_returns_404_for_invalid_domain() {
        given()
                .when().get("/calm/domains/" + INVALID_DOMAIN + "/controls/1/requirement/versions")
                .then()
                .statusCode(404);
    }

    // --- Configuration Endpoints ---

    @Test
    @Order(13)
    void end_to_end_get_configurations_returns_empty_for_control_with_no_configurations() {
        given()
                .when().get("/calm/domains/" + VALID_DOMAIN + "/controls/1/configurations")
                .then()
                .statusCode(200)
                .body("values", empty());
    }

    @Test
    @Order(14)
    void end_to_end_get_configurations_returns_404_for_invalid_control() {
        given()
                .when().get("/calm/domains/" + VALID_DOMAIN + "/controls/999/configurations")
                .then()
                .statusCode(404);
    }

    @Test
    @Order(15)
    void end_to_end_get_configuration_returns_404_for_nonexistent_config() {
        given()
                .when().get("/calm/domains/" + VALID_DOMAIN + "/controls/1/configurations/999")
                .then()
                .statusCode(404);
    }

    @Test
    @Order(16)
    void end_to_end_get_configuration_versions_returns_404_for_nonexistent_config() {
        given()
                .when().get("/calm/domains/" + VALID_DOMAIN + "/controls/1/configurations/999/versions")
                .then()
                .statusCode(404);
    }

    @Test
    @Order(17)
    void end_to_end_get_configuration_version_returns_404_for_nonexistent_config() {
        given()
                .when().get("/calm/domains/" + VALID_DOMAIN + "/controls/1/configurations/999/versions/1.0.0")
                .then()
                .statusCode(404);
    }

    @Test
    @Order(18)
    void end_to_end_seed_configuration_and_get_it() {
        // Directly seed a configuration into MongoDB for the existing control
        String mongoUri = ConfigProvider.getConfig().getValue("quarkus.mongodb.connection-string", String.class);
        String mongoDatabase = ConfigProvider.getConfig().getValue("quarkus.mongodb.database", String.class);

        try (MongoClient mongoClient = MongoClients.create(mongoUri)) {
            MongoDatabase database = mongoClient.getDatabase(mongoDatabase);
            MongoCollection<Document> controlCollection = database.getCollection("controls");

            Document configDoc = new Document("configurationId", 100)
                    .append("versions", new Document("1-0-0", new Document("setting", "enabled")));

            controlCollection.updateOne(
                    new Document("domain", VALID_DOMAIN).append("controls.controlId", 1),
                    Updates.push("controls.$.configurations", configDoc)
            );
        }

        // Now verify the configuration list includes the seeded config
        given()
                .when().get("/calm/domains/" + VALID_DOMAIN + "/controls/1/configurations")
                .then()
                .statusCode(200)
                .body("values", hasSize(1))
                .body("values[0]", equalTo(100));
    }

    @Test
    @Order(19)
    void end_to_end_get_seeded_configuration_versions() {
        given()
                .when().get("/calm/domains/" + VALID_DOMAIN + "/controls/1/configurations/100/versions")
                .then()
                .statusCode(200)
                .body("values", hasSize(1))
                .body("values[0]", equalTo("1.0.0"));
    }

    @Test
    @Order(20)
    void end_to_end_get_seeded_configuration_at_specific_version() {
        given()
                .when().get("/calm/domains/" + VALID_DOMAIN + "/controls/1/configurations/100/versions/1.0.0")
                .then()
                .statusCode(200)
                .body("setting", equalTo("enabled"));
    }

    @Test
    @Order(21)
    void end_to_end_get_configuration_at_invalid_version_returns_404() {
        given()
                .when().get("/calm/domains/" + VALID_DOMAIN + "/controls/1/configurations/100/versions/9.9.9")
                .then()
                .statusCode(404);
    }
}
