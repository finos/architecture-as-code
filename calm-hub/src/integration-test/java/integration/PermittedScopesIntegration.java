package integration;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoDatabase;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import org.bson.Document;
import org.eclipse.microprofile.config.ConfigProvider;
import org.finos.calm.domain.UserAccess;
import org.junit.jupiter.api.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;

import static integration.MongoSetup.counterSetup;
import static integration.MongoSetup.namespaceSetup;
import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.hasItem;

/**
 * Verifies that the secure profile enforces JWT authentication and that access decisions
 * are made from the DB (UserAccess), not from JWT scopes.
 *
 * test-user has READ access on namespace "finos" seeded in @BeforeEach.
 */
@QuarkusTest
@TestProfile(IntegrationTestSecureProfile.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class PermittedScopesIntegration {

    private static final Logger logger = LoggerFactory.getLogger(PermittedScopesIntegration.class);
    private static final String PATTERN = "{\"name\": \"demo-pattern\"}";

    @BeforeEach
    void setup() {
        String mongoUri = ConfigProvider.getConfig().getValue("quarkus.mongodb.connection-string", String.class);
        String mongoDatabase = ConfigProvider.getConfig().getValue("quarkus.mongodb.database", String.class);

        if (mongoUri == null || mongoUri.isBlank()) {
            throw new IllegalStateException("MongoDB URI is not set. Check the EndToEndResource configuration.");
        }

        try (MongoClient mongoClient = MongoClients.create(mongoUri)) {
            MongoDatabase database = mongoClient.getDatabase(mongoDatabase);

            if (!database.listCollectionNames().into(new ArrayList<>()).contains("patterns")) {
                database.createCollection("patterns");
                database.getCollection("patterns").insertOne(
                        new Document("namespace", "finos").append("patterns", new ArrayList<>())
                );
            }

            if (!database.listCollectionNames().into(new ArrayList<>()).contains("userAccess")) {
                database.createCollection("userAccess");
                database.getCollection("userAccess").insertOne(
                        new Document("username", "test-user")
                                .append("namespace", "finos")
                                .append("permission", UserAccess.Permission.read.name())
                                .append("userAccessId", 101)
                );
            }

            counterSetup(database);
            namespaceSetup(database);
        }
    }

    /** Gets a user token for test-user. The JWT identifies the user; no application-specific
     *  scopes are needed because access decisions are made from the DB. */
    private String tokenForTestUser(String authServerUrl) {
        return given()
                .auth().preemptive().basic("calm-hub-client-app", "calm-hub-client-app-secret")
                .formParam("grant_type", "password")
                .formParam("username", "test-user")
                .formParam("password", "changeme")
                .when()
                .post(authServerUrl + "/protocol/openid-connect/token")
                .then()
                .statusCode(200)
                .extract()
                .path("access_token");
    }

    @Test
    @Order(1)
    void authenticated_user_with_db_read_access_can_read_patterns() {
        String authServerUrl = ConfigProvider.getConfig().getValue("quarkus.oidc.auth-server-url", String.class);
        String token = tokenForTestUser(authServerUrl);

        given()
                .auth().oauth2(token)
                .when().get("/api/calm/namespaces/finos/patterns")
                .then()
                .statusCode(200)
                .body("values", empty());
    }

    @Test
    @Order(2)
    void authenticated_user_with_read_only_db_access_cannot_create_pattern() {
        String authServerUrl = ConfigProvider.getConfig().getValue("quarkus.oidc.auth-server-url", String.class);
        String token = tokenForTestUser(authServerUrl);

        given()
                .auth().oauth2(token)
                .body(PATTERN)
                .header("Content-Type", "application/json")
                .when().post("/api/calm/namespaces/finos/patterns")
                .then()
                .statusCode(403);
    }

    @Test
    @Order(3)
    void unauthenticated_request_is_rejected() {
        given()
                .body(PATTERN)
                .header("Content-Type", "application/json")
                .when().post("/api/calm/namespaces/finos/patterns")
                .then()
                .statusCode(401);
    }

    @Test
    @Order(4)
    void authenticated_user_with_db_read_access_can_read_namespaces() {
        String authServerUrl = ConfigProvider.getConfig().getValue("quarkus.oidc.auth-server-url", String.class);
        String token = tokenForTestUser(authServerUrl);

        given()
                .auth().oauth2(token)
                .when().get("/api/calm/namespaces")
                .then()
                .statusCode(200)
                .body("values.name", hasItem("finos"))
                .body("values.description", hasItem("FINOS namespace"));
    }

    @Test
    @Order(5)
    void unauthenticated_request_for_namespaces_is_rejected() {
        given()
                .when().get("/api/calm/namespaces")
                .then()
                .statusCode(401);
    }
}
