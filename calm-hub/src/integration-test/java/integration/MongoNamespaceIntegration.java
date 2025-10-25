package integration;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoDatabase;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import org.eclipse.microprofile.config.ConfigProvider;
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

    @BeforeEach
    public void setupNamespaces() {
        String mongoUri = ConfigProvider.getConfig().getValue("quarkus.mongodb.connection-string", String.class);
        String mongoDatabase = ConfigProvider.getConfig().getValue("quarkus.mongodb.database", String.class);

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
                .when().get("/calm/namespaces")
                .then()
                .statusCode(200)
                .body("values", hasItem("finos"));
    }
}
