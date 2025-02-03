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

import static integration.MongoSetup.counterSetup;
import static integration.MongoSetup.namespaceSetup;
import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.empty;

@QuarkusTest
@TestProfile(IntegrationTestSecureProfile.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class ScopesAllowedIntegration {

    private static final Logger logger = LoggerFactory.getLogger(ScopesAllowedIntegration.class);
    public static final String PATTERN = "{\"name\": \"demo-pattern\"}";

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
    }

    @Test
    @Order(1)
    void end_to_end_get_patterns_with_valid_scopes() {
        String authServerUrl = ConfigProvider.getConfig().getValue("quarkus.oidc.auth-server-url", String.class);
        logger.info("authServerUrl {}", authServerUrl);
        String accessToken = getAccessToken(authServerUrl);
        given()
                .auth().oauth2(accessToken)
                .when().get("/calm/namespaces/finos/patterns")
                .then()
                .statusCode(200)
                .body("values", empty());
    }

    private String getAccessToken(String authServerUrl) {
        String accessToken = given()
                .auth()
                .preemptive()
                .basic("calm-hub-client-app", "calm-hub-client-app-secret")
                .formParam("grant_type", "client_credentials")
                .formParam("scope", "read:patterns read:namespaces")
                .when()
                .post(authServerUrl.concat("/protocol/openid-connect/token"))
                .then()
                .statusCode(200)
                .extract()
                .path("access_token");
        return accessToken;
    }

    @Test
    @Order(2)
    void end_to_end_forbidden_create_pattern_when_matching_scopes_notfound() {
        String authServerUrl = ConfigProvider.getConfig().getValue("quarkus.oidc.auth-server-url", String.class);
        logger.info("authServerUrl {}", authServerUrl);
        String accessToken = getAccessToken(authServerUrl);

        given()
                .auth().oauth2(accessToken)
                .body(PATTERN)
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/patterns")
                .then()
                .statusCode(403);
    }

    @Test
    @Order(3)
    void end_to_end_unauthorize_create_pattern_request_with_no_access_token() {

        given()
                .body(PATTERN)
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/patterns")
                .then()
                .statusCode(401);
    }
}
