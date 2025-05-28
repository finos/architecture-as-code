package integration;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoDatabase;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import org.bson.Document;
import org.eclipse.microprofile.config.ConfigProvider;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.security.CalmHubScopes;
import org.junit.jupiter.api.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;

import static integration.MongoSetup.counterSetup;
import static integration.MongoSetup.namespaceSetup;
import static io.restassured.RestAssured.given;

@QuarkusTest
@TestProfile(IntegrationTestSecureProfile.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class UserAccessGrantsIntegration {

    private static final Logger logger = LoggerFactory.getLogger(UserAccessGrantsIntegration.class);
    private static final String CREATE_USER_ACCESS_REQUEST = """
              {
                    "username": "testuser1",
                    "permission": "read",
                    "namespace": "finos",
                    "resourceType": "all"
               }
            """;

    private static final String CREATE_USER_ACCESS_REQUEST_2 = """
              {
                    "username": "testuser1",
                    "permission": "read",
                    "namespace": "workshop",
                    "resourceType": "all"
               }
            """;

    @BeforeEach
    void setupPatterns() {
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

            if (!database.listCollectionNames().into(new ArrayList<>()).contains("userAccess")) {
                database.createCollection("userAccess");
            }
            Document document1 = new Document("username", "test-user")
                    .append("namespace", "finos")
                    .append("permission", UserAccess.Permission.write.name())
                    .append("resourceType", UserAccess.ResourceType.all.name())
                    .append("userAccessId", 101);

            database.getCollection("userAccess").insertOne(document1);
            counterSetup(database);
            namespaceSetup(database);
        }
    }

    /**
     *  This grant type is not recommended from production,
     *  the password grant type is using to enrich preferred_username in jwt token to perform RBAC checks after jwt validation.
     */
    private String generateAccessTokenWithPasswordGrantType(String authServerUrl, String scope) {
        String accessToken = given()
                .auth()
                .preemptive()
                .basic("calm-hub-client-app", "calm-hub-client-app-secret")
                .formParam("grant_type", "password")
                .formParam("username", "test-user")
                .formParam("password", "changeme")
                .formParam("scope", scope)
                .when()
                .post(authServerUrl.concat("/protocol/openid-connect/token"))
                .then()
                .statusCode(200)
                .extract()
                .path("access_token");
        return accessToken;
    }

    @Test
    @Order(1)
    void end_to_end_create_user_access_with_namespace_admin_scope_and_with_admin_user_grants() {
        String authServerUrl = ConfigProvider.getConfig().getValue("quarkus.oidc.auth-server-url", String.class);
        logger.info("authServerUrl {}", authServerUrl);
        String accessToken = generateAccessTokenWithPasswordGrantType(authServerUrl, CalmHubScopes.NAMESPACE_ADMIN);
        given()
                .auth().oauth2(accessToken)
                .body(CREATE_USER_ACCESS_REQUEST)
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/user-access")
                .then()
                .statusCode(201);
    }

    @Test
    @Order(2)
    void end_to_end_forbidden_create_user_access_when_admin_has_no_access_on_namespace() {

        String authServerUrl = ConfigProvider.getConfig().getValue("quarkus.oidc.auth-server-url", String.class);
        String accessToken = generateAccessTokenWithPasswordGrantType(authServerUrl, CalmHubScopes.NAMESPACE_ADMIN);
        given()
                .auth().oauth2(accessToken)
                .body(CREATE_USER_ACCESS_REQUEST_2)
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/workshop/patterns")
                .then()
                .statusCode(403);
    }
}