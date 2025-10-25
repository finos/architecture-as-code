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
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;

import static integration.MongoSetup.counterSetup;
import static integration.MongoSetup.namespaceSetup;
import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.hasItem;

@QuarkusTest
@TestProfile(IntegrationTestSecureProfile.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class PermittedScopesIntegration {

    private static final Logger logger = LoggerFactory.getLogger(PermittedScopesIntegration.class);
    private static final String PATTERN = "{\"name\": \"demo-pattern\"}";

    @BeforeEach
    void setupPatterns() {
        String mongoUri = ConfigProvider.getConfig().getValue("quarkus.mongodb.connection-string", String.class);
        String mongoDatabase = ConfigProvider.getConfig().getValue("quarkus.mongodb.database", String.class);

        // Safeguard: Fail fast if URI is not set
        if (mongoUri == null || mongoUri.isBlank()) {
            logger.error("MongoDB URI is not set. Check the EndToEndResource configuration.");
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
                Document document1 = new Document("username", "test-user")
                        .append("namespace", "finos")
                        .append("permission", UserAccess.Permission.read.name())
                        .append("resourceType", UserAccess.ResourceType.patterns.name())
                        .append("userAccessId", 101);

                database.getCollection("userAccess").insertOne(document1);
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
        String accessToken = generateAccessTokenWithPasswordGrantType(authServerUrl, CalmHubScopes.ARCHITECTURES_READ);
        given()
                .auth().oauth2(accessToken)
                .when().get("/calm/namespaces/finos/patterns")
                .then()
                .statusCode(200)
                .body("values", empty());
    }

    private String generateAccessTokenWithClientCredentialGrant(String authServerUrl, String scope) {
        String accessToken = given()
                .auth()
                .preemptive()
                .basic("calm-hub-client-app", "calm-hub-client-app-secret")
                .formParam("grant_type", "client_credentials")
                .formParam("scope", scope)
                .when()
                .post(authServerUrl.concat("/protocol/openid-connect/token"))
                .then()
                .statusCode(200)
                .extract()
                .path("access_token");
        return accessToken;
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
    @Order(2)
    void end_to_end_forbidden_create_pattern_when_matching_scopes_notfound() {
        String authServerUrl = ConfigProvider.getConfig().getValue("quarkus.oidc.auth-server-url", String.class);
        logger.info("authServerUrl {}", authServerUrl);
        String accessToken = generateAccessTokenWithClientCredentialGrant(authServerUrl, CalmHubScopes.ARCHITECTURES_READ);

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

    @ParameterizedTest
    @ValueSource(strings = {CalmHubScopes.ADRS_READ, CalmHubScopes.ADRS_ALL,
            CalmHubScopes.ARCHITECTURES_ALL, CalmHubScopes.ARCHITECTURES_READ})
    @Order(4)
    void end_to_end_get_namespaces_with_valid_access_token(String scope) {
        String authServerUrl = ConfigProvider.getConfig().getValue("quarkus.oidc.auth-server-url", String.class);
        logger.info("authServerUrl {}", authServerUrl);
        String accessToken = generateAccessTokenWithClientCredentialGrant(authServerUrl, scope);
        given()
                .auth().oauth2(accessToken)
                .when().get("/calm/namespaces")
                .then()
                .statusCode(200)
                .body("values", hasItem("finos"));
    }

    @Test
    @Order(5)
    void end_to_end_forbidden_get_namespaces_when_matching_scopes_notfound() {
        String authServerUrl = ConfigProvider.getConfig().getValue("quarkus.oidc.auth-server-url", String.class);
        logger.info("authServerUrl {}", authServerUrl);
        String accessToken = generateAccessTokenWithClientCredentialGrant(authServerUrl, "deny:all");
        given()
                .auth().oauth2(accessToken)
                .when().get("/calm/namespaces")
                .then()
                .statusCode(403);
    }

    @Test
    @Order(6)
    void end_to_end_forbidden_create_pattern_with_matching_scopes_but_no_user_permissions() {
        String authServerUrl = ConfigProvider.getConfig().getValue("quarkus.oidc.auth-server-url", String.class);
        logger.info("authServerUrl {}", authServerUrl);
        String accessToken = generateAccessTokenWithPasswordGrantType(authServerUrl, CalmHubScopes.ARCHITECTURES_ALL);
        logger.info("accessToken: {}", accessToken);
        given()
                .auth().oauth2(accessToken)
                .body(PATTERN)
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/patterns")
                .then()
                .statusCode(403);
    }
}