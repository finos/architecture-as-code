package integration;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoDatabase;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import org.bson.Document;
import org.eclipse.microprofile.config.ConfigProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
@TestProfile(IntegrationTestProfile.class)
public class MongoSchemaIntegration {

    private static final Logger logger = LoggerFactory.getLogger(MongoSchemaIntegration.class);
    public static final String CALM_TEST_SCHEMA = "{\"name\":\"calm-test-schema\"";
    public static final String INTERFACE_TEST_SCHEMA = "{\"name\":\"interface-test-schema\"";

    @BeforeEach
    public void setupSchemas() {
        String mongoUri = ConfigProvider.getConfig().getValue("quarkus.mongodb.connection-string", String.class);

        // Safeguard: Fail fast if URI is not set
        if (mongoUri == null || mongoUri.isBlank()) {
            logger.error("MongoDB URI is not set. Check the EndToEndResource configuration.");
            throw new IllegalStateException("MongoDB URI is not set. Check the EndToEndResource configuration.");
        }

        try (MongoClient mongoClient = MongoClients.create(mongoUri)) {
            MongoDatabase database = mongoClient.getDatabase("calmSchemas");

            // Ensure the 'namespaces' collection exists
            if (!database.listCollectionNames().into(new ArrayList<>()).contains("schemas")) {
                database.createCollection("schemas");
            }

            Document schemaStub = new Document();
            schemaStub.put("version", "2024-04");
            schemaStub.put("schemas", new Document()
                    .append("calm.json", CALM_TEST_SCHEMA)
                    .append("interface.json", INTERFACE_TEST_SCHEMA));

            database.getCollection("schemas").insertOne(schemaStub);
        }
    }

    @Test
    void end_to_end_confirmation_of_schema_versions() {
        given()
                .when().get("/calm/schemas")
                .then()
                .statusCode(200)
                .body("values", hasItem("2024-04"));
    }

    @Test
    void end_to_end_confirmation_of_available_schemas() {
        given()
                .when().get("/calm/schemas/2024-04/meta")
                .then()
                .statusCode(200)
                .body("values", hasItems("calm.json", "interface.json"));
    }

    @Test
    void end_to_end_confirmation_of_calm_json() {
        given()
                .when().get("/calm/schemas/2024-04/meta/calm.json")
                .then()
                .statusCode(200)
                .body(equalTo(CALM_TEST_SCHEMA));
    }

    @Test
    void end_to_end_confirmation_of_interface_json() {
        given()
                .when().get("/calm/schemas/2024-04/meta/interface.json")
                .then()
                .statusCode(200)
                .body(equalTo(INTERFACE_TEST_SCHEMA));
    }
}
