package integration;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoDatabase;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import jakarta.inject.Inject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import static io.restassured.RestAssured.given;
import static integration.MongoSetup.namespaceSetup;
import static org.hamcrest.Matchers.hasItem;

@QuarkusTest
@TestProfile(IntegrationTestProfile.class)
public class MongoNamespaceIntegration {

    private static final Logger logger = LoggerFactory.getLogger(MongoNamespaceIntegration.class);

    @Inject
    MongoTestConnection mongoTestConnection;

    @BeforeEach
    public void setupNamespaces() {
        String mongoUri = mongoTestConnection.connectionString();
        String mongoDatabase = mongoTestConnection.database();

        // Safeguard: Fail fast if URI is not set
        if (mongoUri == null || mongoUri.isBlank()) {
            logger.error("MongoDB URI is not set. Check the EndToEndResource configuration.");
            throw new IllegalStateException("MongoDB URI is not set. Check the EndToEndResource configuration.");
        }

        try (MongoClient mongoClient = MongoClients.create(mongoUri)) {
            MongoDatabase database = mongoClient.getDatabase(mongoDatabase);

            namespaceSetup(database);
        }
    }

    @Test
    void end_to_end_confirmation_of_namespaces() {
        given()
                .when().get("/api/calm/namespaces")
                .then()
                .statusCode(200)
                .body("values.name", hasItem("finos"))
                .body("values.description", hasItem("FINOS namespace"));
    }
}
