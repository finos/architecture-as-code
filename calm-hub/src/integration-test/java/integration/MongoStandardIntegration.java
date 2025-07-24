package integration;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoDatabase;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import org.bson.Document;
import org.eclipse.microprofile.config.ConfigProvider;
import org.finos.calm.domain.Standard;
import org.finos.calm.domain.standards.CreateStandardRequest;
import org.junit.jupiter.api.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

import static integration.MongoSetup.counterSetup;
import static integration.MongoSetup.namespaceSetup;
import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
@TestProfile(IntegrationTestProfile.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class MongoStandardIntegration {

    private static final Logger logger = LoggerFactory.getLogger(MongoStandardIntegration.class);

    Standard testStandard;
    CreateStandardRequest createStandardRequest;

    private static final String NAMESPACE = "finos";
    private static final String NAME = "Test Standard";
    private static final String DESCRIPTION = "Test Standard Description";

    @BeforeEach
    public void setupStandards() {
        String mongoUri = ConfigProvider.getConfig().getValue("quarkus.mongodb.connection-string", String.class);

        // Safeguard: Fail fast if URI is not set
        if (mongoUri == null || mongoUri.isBlank()) {
            logger.error("MongoDB URI is not set. Check the EndToEndResource configuration.");
            throw new IllegalStateException("MongoDB URI is not set. Check the EndToEndResource configuration.");
        }

        try (MongoClient mongoClient = MongoClients.create(mongoUri)) {
            MongoDatabase database = mongoClient.getDatabase("calmSchemas");

            if (!database.listCollectionNames().into(new ArrayList<>()).contains("standards")) {
                database.createCollection("standards");
                database.getCollection("standards").insertOne(
                        new Document("namespace", "finos").append("standards", new ArrayList<>())
                );
            }

            counterSetup(database);
            namespaceSetup(database);
        }

        createStandardRequest = new CreateStandardRequest(NAME, DESCRIPTION, "{}");

        testStandard = new Standard(createStandardRequest);
        testStandard.setNamespace("finos");
    }

    @Test
    @Order(1)
    void end_to_end_get_with_no_standards() {
        given()
                .when().get("/calm/namespaces/finos/standards")
                .then()
                .statusCode(200)
                .body("values", empty());
    }

    @Test
    @Order(2)
    void end_to_end_create_a_standard() {
        given()
                .body(createStandardRequest)
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/standards")
                .then()
                .statusCode(201)
                .header("Location", containsString("calm/namespaces/finos/standards/1"));
    }

    @Test
    @Order(3)
    void end_to_end_verify_versions() {
        given()
                .when().get("/calm/namespaces/finos/standards/1/versions")
                .then()
                .statusCode(200)
                .body("values", hasSize(1))
                .body("values[0]", equalTo("1.0.0"));
    }

    @Test
    @Order(4)
    void end_to_end_verify_standard() {
        given()
                .when().get("/calm/namespaces/finos/standards/1/versions/1.0.0")
                .then()
                .statusCode(200)
                .body(equalTo("{\"id\":1,\"namespace\":\"finos\",\"standardJson\":\"{}\",\"version\":\"1.0.0\"}"));
    }

    @Test
    @Order(5)
    void end_to_end_create_a_new_standard_version_for_standard() {
        setupTestStandardForPersistenceRetrieval();

        given()
                .body(createStandardRequest)
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/standards/1/versions/2.0.0")
                .then()
                .statusCode(201)
                .header("Location", containsString("calm/namespaces/finos/standards/1/versions/2.0.0"));
    }

    @Test
    @Order(6)
    void end_to_end_verify_retrieval_of_standard_json() {
        setupTestStandardForPersistenceRetrieval();

        given()
                .when().get("/calm/namespaces/finos/standards/1/versions/2.0.0")
                .then()
                .statusCode(200)
                .body(equalTo("{\"id\":1,\"namespace\":\"finos\",\"standardJson\":\"{}\",\"version\":\"2.0.0\"}"));
    }

    @Test
    void end_to_end_verify_standard_details_and_if_they_are_updated() {
        setupTestStandardForPersistenceRetrieval();

        Map<String, Object> expected = new HashMap<>();
        expected.put("id", 1);
        expected.put("name", "New Name");
        expected.put("description", "New Description");

        given()
                .when().get("/calm/namespaces/finos/standards")
                .then()
                .statusCode(200)
                .body("values", hasItem(equalTo(expected)));
    }

    private void setupTestStandardForPersistenceRetrieval() {
        createStandardRequest.setStandardJson("{}");
        createStandardRequest.setName("New Name");
        createStandardRequest.setDescription("New Description");
    }
}
