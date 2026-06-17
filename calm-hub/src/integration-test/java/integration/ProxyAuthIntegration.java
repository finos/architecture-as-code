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
import java.util.List;

import static integration.MongoSetup.*;
import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.notNullValue;

/**
 * Verifies that the proxy-auth profile authenticates users via the Remote-User
 * HTTP header and that all access decisions are driven exclusively by the
 * DB-level entitlements stored in userAccess — not by any token or scope.
 *
 * Users seeded in @BeforeEach:
 *   alice   — namespace finos,   permission READ
 *   bob     — namespace finos,   permission WRITE
 *   charlie — namespace finos,   permission ADMIN
 *   dave    — namespace GLOBAL,  permission ADMIN  (global admin)
 *   eve     — domain   security, permission READ
 */
@QuarkusTest
@TestProfile(IntegrationTestProxyAuthProfile.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class ProxyAuthIntegration {

    private static final Logger logger = LoggerFactory.getLogger(ProxyAuthIntegration.class);

    private static final String PROXY_HEADER = "Remote-User";

    private static final String USER_ALICE   = "alice";    // namespace finos  READ
    private static final String USER_BOB     = "bob";      // namespace finos  WRITE
    private static final String USER_CHARLIE = "charlie";  // namespace finos  ADMIN
    private static final String USER_DAVE    = "dave";     // namespace GLOBAL ADMIN
    private static final String USER_EVE     = "eve";      // domain   security READ

    private static final String PATTERN_JSON = """
            {
              "name": "proxy-auth-test-pattern",
              "description": "created during proxy-auth integration test",
              "patternJson": "{\\"nodes\\":[]}"
            }
            """;

    private static final String CONTROL_JSON = """
            {
              "name": "proxy-auth-control",
              "description": "created during proxy-auth integration test",
              "requirementJson": "{\\"rule\\":\\"test\\"}"
            }
            """;

    private static final String USER_ACCESS_FINOS_JSON = """
            { "username": "new-grantee", "permission": "read", "namespace": "finos" }
            """;

    private static final String USER_ACCESS_WORKSHOP_JSON = """
            { "username": "new-grantee", "permission": "read", "namespace": "workshop" }
            """;

    private static final String NAMESPACE_JSON = """
            { "name": "proxy-auth-ns", "description": "created by global admin under test" }
            """;

    @BeforeEach
    void setup() {
        String mongoUri = ConfigProvider.getConfig().getValue("quarkus.mongodb.connection-string", String.class);
        String mongoDatabase = ConfigProvider.getConfig().getValue("quarkus.mongodb.database", String.class);

        if (mongoUri == null || mongoUri.isBlank()) {
            throw new IllegalStateException("MongoDB URI is not set. Check EndToEndResource configuration.");
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
                database.getCollection("userAccess").insertMany(List.of(
                        new Document("username", USER_ALICE)
                                .append("namespace", "finos")
                                .append("permission", UserAccess.Permission.read.name())
                                .append("userAccessId", 101),
                        new Document("username", USER_BOB)
                                .append("namespace", "finos")
                                .append("permission", UserAccess.Permission.write.name())
                                .append("userAccessId", 102),
                        new Document("username", USER_CHARLIE)
                                .append("namespace", "finos")
                                .append("permission", UserAccess.Permission.admin.name())
                                .append("userAccessId", 103),
                        new Document("username", USER_DAVE)
                                .append("namespace", "GLOBAL")
                                .append("permission", UserAccess.Permission.admin.name())
                                .append("userAccessId", 104),
                        new Document("username", USER_EVE)
                                .append("domain", "security")
                                .append("permission", UserAccess.Permission.read.name())
                                .append("userAccessId", 105)
                ));
            }

            counterSetup(database);
            namespaceSetup(database);
            domainSetup(database);
        }
    }

    // ── Authentication ────────────────────────────────────────────────────────

    @Test
    @Order(1)
    void request_without_proxy_header_is_rejected_with_401() {
        given()
                .when().get("/api/calm/namespaces/finos/patterns")
                .then()
                .statusCode(401);
    }

    @Test
    @Order(2)
    void request_with_unknown_user_who_has_no_db_grants_is_forbidden() {
        given()
                .header(PROXY_HEADER, "unknown-user")
                .when().get("/api/calm/namespaces/finos/patterns")
                .then()
                .statusCode(403);
    }

    // ── Namespace READ entitlement ────────────────────────────────────────────

    @Test
    @Order(3)
    void user_with_read_grant_can_read_patterns_for_their_namespace() {
        given()
                .header(PROXY_HEADER, USER_ALICE)
                .when().get("/api/calm/namespaces/finos/patterns")
                .then()
                .statusCode(200)
                .body("values", notNullValue());
    }

    @Test
    @Order(4)
    void user_with_read_grant_is_forbidden_from_creating_a_pattern() {
        given()
                .header(PROXY_HEADER, USER_ALICE)
                .header("Content-Type", "application/json")
                .body(PATTERN_JSON)
                .when().post("/api/calm/namespaces/finos/patterns")
                .then()
                .statusCode(403);
    }

    @Test
    @Order(5)
    void user_with_read_grant_is_forbidden_from_accessing_a_different_namespace() {
        given()
                .header(PROXY_HEADER, USER_ALICE)
                .when().get("/api/calm/namespaces/workshop/patterns")
                .then()
                .statusCode(403);
    }

    // ── Namespace WRITE entitlement ───────────────────────────────────────────

    @Test
    @Order(6)
    void user_with_write_grant_can_read_patterns_because_write_implies_read() {
        given()
                .header(PROXY_HEADER, USER_BOB)
                .when().get("/api/calm/namespaces/finos/patterns")
                .then()
                .statusCode(200);
    }

    @Test
    @Order(7)
    void user_with_write_grant_can_create_a_pattern() {
        given()
                .header(PROXY_HEADER, USER_BOB)
                .header("Content-Type", "application/json")
                .body(PATTERN_JSON)
                .when().post("/api/calm/namespaces/finos/patterns")
                .then()
                .statusCode(201);
    }

    @Test
    @Order(8)
    void user_with_write_grant_on_finos_is_forbidden_from_writing_to_another_namespace() {
        given()
                .header(PROXY_HEADER, USER_BOB)
                .header("Content-Type", "application/json")
                .body(PATTERN_JSON)
                .when().post("/api/calm/namespaces/workshop/patterns")
                .then()
                .statusCode(403);
    }

    // ── Namespace ADMIN entitlement ───────────────────────────────────────────

    @Test
    @Order(9)
    void user_with_admin_grant_can_create_user_access_on_their_namespace() {
        given()
                .header(PROXY_HEADER, USER_CHARLIE)
                .header("Content-Type", "application/json")
                .body(USER_ACCESS_FINOS_JSON)
                .when().post("/api/calm/namespaces/finos/user-access")
                .then()
                .statusCode(201);
    }

    @Test
    @Order(10)
    void user_with_admin_on_finos_is_forbidden_from_managing_access_on_another_namespace() {
        given()
                .header(PROXY_HEADER, USER_CHARLIE)
                .header("Content-Type", "application/json")
                .body(USER_ACCESS_WORKSHOP_JSON)
                .when().post("/api/calm/namespaces/workshop/user-access")
                .then()
                .statusCode(403);
    }

    // ── GLOBAL ADMIN entitlement ──────────────────────────────────────────────

    @Test
    @Order(11)
    void user_with_global_admin_grant_can_create_a_namespace() {
        given()
                .header(PROXY_HEADER, USER_DAVE)
                .header("Content-Type", "application/json")
                .body(NAMESPACE_JSON)
                .when().post("/api/calm/namespaces")
                .then()
                .statusCode(201);
    }

    @Test
    @Order(12)
    void user_with_only_namespace_write_grant_is_forbidden_from_creating_namespaces() {
        given()
                .header(PROXY_HEADER, USER_BOB)
                .header("Content-Type", "application/json")
                .body("{\"name\": \"blocked-ns\", \"description\": \"should be blocked\"}")
                .when().post("/api/calm/namespaces")
                .then()
                .statusCode(403);
    }

    // ── Domain READ entitlement ───────────────────────────────────────────────

    @Test
    @Order(13)
    void user_with_domain_read_grant_can_read_controls_for_their_domain() {
        given()
                .header(PROXY_HEADER, USER_EVE)
                .when().get("/calm/domains/security/controls")
                .then()
                .statusCode(200);
    }

    @Test
    @Order(14)
    void user_with_domain_read_grant_is_forbidden_from_creating_a_control() {
        given()
                .header(PROXY_HEADER, USER_EVE)
                .header("Content-Type", "application/json")
                .body(CONTROL_JSON)
                .when().post("/calm/domains/security/controls/access-control/requirement/versions/1.0.0")
                .then()
                .statusCode(403);
    }

    @Test
    @Order(15)
    void user_with_namespace_grant_only_is_forbidden_from_reading_domain_controls() {
        given()
                .header(PROXY_HEADER, USER_ALICE)
                .when().get("/calm/domains/security/controls")
                .then()
                .statusCode(403);
    }
}
