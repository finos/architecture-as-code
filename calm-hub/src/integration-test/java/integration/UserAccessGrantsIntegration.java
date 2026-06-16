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

/**
 * Verifies that user-access grant operations respect DB-level permissions.
 *
 * test-user is seeded with ADMIN access on namespace "finos" in @BeforeEach.
 */
@QuarkusTest
@TestProfile(IntegrationTestSecureProfile.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class UserAccessGrantsIntegration {

    private static final Logger logger = LoggerFactory.getLogger(UserAccessGrantsIntegration.class);

    private static final String GRANT_FOR_FINOS = """
            {
              "username": "testuser1",
              "permission": "read",
              "namespace": "finos"
            }
            """;

    private static final String GRANT_FOR_WORKSHOP = """
            {
              "username": "testuser1",
              "permission": "read",
              "namespace": "workshop"
            }
            """;

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
            }

            // test-user has admin access on finos, so they can manage grants there
            database.getCollection("userAccess").insertOne(
                    new Document("username", "test-user")
                            .append("namespace", "finos")
                            .append("permission", UserAccess.Permission.admin.name())
                            .append("userAccessId", 101)
            );

            counterSetup(database);
            namespaceSetup(database);
        }
    }

    /** Gets a user token for test-user. The JWT identifies the user; authorization is from the DB. */
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
    void user_with_namespace_admin_access_can_create_user_access_grant() {
        String authServerUrl = ConfigProvider.getConfig().getValue("quarkus.oidc.auth-server-url", String.class);
        String token = tokenForTestUser(authServerUrl);

        given()
                .auth().oauth2(token)
                .body(GRANT_FOR_FINOS)
                .header("Content-Type", "application/json")
                .when().post("/api/calm/namespaces/finos/user-access")
                .then()
                .statusCode(201);
    }

    @Test
    @Order(2)
    void user_with_admin_access_on_one_namespace_cannot_create_grant_on_another() {
        String authServerUrl = ConfigProvider.getConfig().getValue("quarkus.oidc.auth-server-url", String.class);
        String token = tokenForTestUser(authServerUrl);

        given()
                .auth().oauth2(token)
                .body(GRANT_FOR_WORKSHOP)
                .header("Content-Type", "application/json")
                .when().post("/api/calm/namespaces/workshop/user-access")
                .then()
                .statusCode(403);
    }
}
