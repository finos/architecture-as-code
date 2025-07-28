package integration;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoDatabase;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import org.bson.Document;
import org.eclipse.microprofile.config.ConfigProvider;
import org.finos.calm.domain.Pattern;
import org.finos.calm.domain.patterns.CreatePatternRequest;
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
    
    Pattern testPattern;
    CreatePatternRequest createPatternRequest;

    private static final String NAMESPACE = "finos";
    private static final String NAME = "Test Pattern";
    private static final String DESCRIPTION = "Test Pattern Description";

    @BeforeEach
    public void setupPatterns() {
        String mongoUri = ConfigProvider.getConfig().getValue("quarkus.mongodb.connection-string", String.class);

        // Safeguard: Fail fast if URI is not set
        if (mongoUri == null || mongoUri.isBlank()) {
            logger.error("MongoDB URI is not set. Check the EndToEndResource configuration.");
            throw new IllegalStateException("MongoDB URI is not set. Check the EndToEndResource configuration.");
        }

        try (MongoClient mongoClient = MongoClients.create(mongoUri)) {
            MongoDatabase database = mongoClient.getDatabase("calmSchemas");

            if (!database.listCollectionNames().into(new ArrayList<>()).contains("patterns")) {
                database.createCollection("patterns");
                database.getCollection("patterns").insertOne(
                        new Document("namespace", "finos").append("patterns", new ArrayList<>())
                );
            }

            counterSetup(database);
            namespaceSetup(database);
        }

        createPatternRequest = new CreatePatternRequest(NAME, DESCRIPTION, "{}");

        testPattern = new Pattern(createPatternRequest);
        testPattern.setNamespace("finos");
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
        given()
                .body(createPatternRequest)
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
                .body(equalTo("{\"id\":1,\"namespace\":\"finos\",\"patternJson\":\"{}\",\"version\":\"2.0.0\"}"));
    }

    @Test
    @Order(5)
    void end_to_end_create_a_new_pattern_version_for_pattern() {
        setupTestpatternForPersistenceRetrieval();

        given()
                .body(testPattern)
                .body(createPatternRequest)
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/patterns/1/versions/2.0.0")
                .then()
                .statusCode(201)
                .header("Location", containsString("calm/namespaces/finos/patterns/1/versions/2.0.0"));
    }
}
