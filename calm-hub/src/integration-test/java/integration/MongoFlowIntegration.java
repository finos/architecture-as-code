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
public class MongoFlowIntegration {

    private static final Logger logger = LoggerFactory.getLogger(MongoFlowIntegration.class);
    public static final String FLOW = "{\"name\": \"demo-flow\"}";
    public static final String FLOW_V2 = "{\"name\": \"demo-flow-v2\"}";

    @BeforeEach
    public void setupFlows() {
        String mongoUri = ConfigProvider.getConfig().getValue("quarkus.mongodb.connection-string", String.class);

        // Safeguard: Fail fast if URI is not set
        if (mongoUri == null || mongoUri.isBlank()) {
            logger.error("MongoDB URI is not set. Check the EndToEndResource configuration.");
            throw new IllegalStateException("MongoDB URI is not set. Check the EndToEndResource configuration.");
        }

        try (MongoClient mongoClient = MongoClients.create(mongoUri)) {
            MongoDatabase database = mongoClient.getDatabase("calmSchemas");

            if (!database.listCollectionNames().into(new ArrayList<>()).contains("flows")) {
                database.createCollection("flows");
                database.getCollection("flows").insertOne(
                        new Document("namespace", "finos").append("flows", new ArrayList<>())
                );
            }

            counterSetup(database);
            namespaceSetup(database);
        }
    }

    @Test
    @Order(1)
    void end_to_end_get_with_no_flow() {
        given()
                .when().get("/calm/namespaces/finos/flows")
                .then()
                .statusCode(200)
                .body("values", empty());
    }

    @Test
    @Order(2)
    void end_to_end_create_an_flow() {
        given()
                .body(FLOW)
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/flows")
                .then()
                .statusCode(201)
                .header("Location", containsString("calm/namespaces/finos/flows/1"));
    }

    @Test
    @Order(3)
    void end_to_end_verify_versions() {
        given()
                .when().get("/calm/namespaces/finos/flows/1/versions")
                .then()
                .statusCode(200)
                .body("values", hasSize(1))
                .body("values[0]", equalTo("1.0.0"));
    }

    @Test
    @Order(4)
    void end_to_end_verify_flow() {
        given()
                .when().get("/calm/namespaces/finos/flows/1/versions/1.0.0")
                .then()
                .statusCode(200)
                .body(equalTo(FLOW));
    }

    @Test
    @Order(5)
    void end_to_end_verify_latest_flow() {
        given()
                .body(FLOW_V2)
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/flows/1/versions/2.0.0")
                .then()
                .statusCode(201)
                .header("Location", containsString("calm/namespaces/finos/flows/1/versions/2.0.0"));

        given()
                .when().get("/calm/namespaces/finos/flows/1")
                .then()
                .statusCode(200)
                .body(equalTo(FLOW_V2));
    }
}
