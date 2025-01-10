package integration;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoDatabase;
import io.quarkus.test.common.QuarkusTestResource;
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
public class MongoArchitectureIntegration {

    private static final Logger logger = LoggerFactory.getLogger(MongoArchitectureIntegration.class);
    public static final String ARCHITECTURE = "{\"name\": \"demo-pattern\"}";

    @BeforeEach
    public void setupArchitectures() {
        String mongoUri = ConfigProvider.getConfig().getValue("quarkus.mongodb.connection-string", String.class);

        // Safeguard: Fail fast if URI is not set
        if (mongoUri == null || mongoUri.isBlank()) {
            logger.error("MongoDB URI is not set. Check the EndToEndResource configuration.");
            throw new IllegalStateException("MongoDB URI is not set. Check the EndToEndResource configuration.");
        }

        try (MongoClient mongoClient = MongoClients.create(mongoUri)) {
            MongoDatabase database = mongoClient.getDatabase("calmSchemas");

            if (!database.listCollectionNames().into(new ArrayList<>()).contains("architectures")) {
                database.createCollection("architectures");
                database.getCollection("architectures").insertOne(
                        new Document("namespace", "finos").append("architectures", new ArrayList<>())
                );
            }

            counterSetup(database);
            namespaceSetup(database);
        }
    }

    @Test
    @Order(1)
    void end_to_end_get_with_no_architecture() {
        given()
                .when().get("/calm/namespaces/finos/architectures")
                .then()
                .statusCode(200)
                .body("values", empty());
    }

    @Test
    @Order(2)
    void end_to_end_create_an_architecture() {
        given()
                .body(ARCHITECTURE)
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/architectures")
                .then()
                .statusCode(201)
                .header("Location", containsString("calm/namespaces/finos/architectures/1"));
    }

    @Test
    @Order(3)
    void end_to_end_verify_versions() {
        given()
                .when().get("/calm/namespaces/finos/architectures/1/versions")
                .then()
                .statusCode(200)
                .body("values", hasSize(1))
                .body("values[0]", equalTo("1.0.0"));
    }

    @Test
    @Order(4)
    void end_to_end_verify_architecture() {
        given()
                .when().get("/calm/namespaces/finos/architectures/1/versions/1.0.0")
                .then()
                .statusCode(200)
                .body(equalTo(ARCHITECTURE));
    }
}
