package integration;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import org.bson.Document;
import org.eclipse.microprofile.config.ConfigProvider;
import org.finos.calm.domain.UserAccess;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;

import static integration.MongoSetup.counterSetup;
import static integration.MongoSetup.namespaceSetup;
import static io.restassured.RestAssured.given;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;

/**
 * The direct empirical resolution of the design's flagged risk: does
 * {@code UriInfo.getPathParameters()} really return resolved values in
 * {@code AuditRequestFilter} (a post-matching {@code ContainerResponseFilter}) when the
 * response was produced by a {@code @PermissionsAllowed} denial — i.e. a security
 * exception thrown by a CDI interceptor before the resource method body ever runs —
 * as opposed to a normal method return?
 *
 * <p>Uses the same secure/Keycloak profile and read-only "test-user" grant pattern as
 * {@code PermittedScopesIntegration}, which already establishes that a real 403 occurs
 * here via the {@code @PermissionsAllowed(CalmHubScopes.WRITE)} interceptor on
 * {@code PatternResource.createPatternForNamespace}.</p>
 */
@QuarkusTest
@TestProfile(IntegrationTestSecureProfile.class)
public class MongoAuditLogDeniedIntegration {

    private static final Logger logger = LoggerFactory.getLogger(MongoAuditLogDeniedIntegration.class);
    private static final String PATTERN = "{\"name\": \"demo-pattern\"}";

    private MongoClient mongoClient;
    private MongoDatabase database;

    @BeforeEach
    void setup() {
        String mongoUri = ConfigProvider.getConfig().getValue("quarkus.mongodb.connection-string", String.class);
        String mongoDatabaseName = ConfigProvider.getConfig().getValue("quarkus.mongodb.database", String.class);

        if (mongoUri == null || mongoUri.isBlank()) {
            throw new IllegalStateException("MongoDB URI is not set. Check the EndToEndResource configuration.");
        }

        mongoClient = MongoClients.create(mongoUri);
        database = mongoClient.getDatabase(mongoDatabaseName);

        if (!database.listCollectionNames().into(new ArrayList<>()).contains("patterns")) {
            database.createCollection("patterns");
// Collection only — no per-namespace document. That priming belonged to the old
            // one-document-per-namespace shape; under the header/version shape it has no id
            // field, so the header reader surfaces it as a resource named "<Type> null".
        }

        boolean grantExists = database.getCollection("userAccess").find(Filters.and(
                Filters.eq("username", "test-user"),
                Filters.eq("namespace", "finos"),
                Filters.eq("permission", UserAccess.Permission.read.name())
        )).first() != null;
        if (!grantExists) {
            database.getCollection("userAccess").insertOne(
                    new Document("username", "test-user")
                            .append("namespace", "finos")
                            .append("permission", UserAccess.Permission.read.name())
                            .append("userAccessId", 101));
        }

        counterSetup(database);
        namespaceSetup(database);
        database.getCollection("auditLogs").deleteMany(new Document());
    }

    @AfterEach
    void tearDown() {
        if (mongoClient != null) {
            mongoClient.close();
        }
    }

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
    void record_a_denied_audit_entry_with_namespace_still_resolved_from_path_params() {
        String authServerUrl = ConfigProvider.getConfig().getValue("quarkus.oidc.auth-server-url", String.class);
        String token = tokenForTestUser(authServerUrl);

        given()
                .auth().oauth2(token)
                .body(PATTERN)
                .header("Content-Type", "application/json")
                .when().post("/api/calm/namespaces/finos/patterns")
                .then()
                .statusCode(403);

        MongoCollection<Document> auditLogs = database.getCollection("auditLogs");
        Document entry = auditLogs.find(new Document("entityType", "PATTERN")).first();

        assertThat(entry, is(notNullValue()));
        assertThat(entry.getString("outcome"), is("DENIED"));
        // The key assertion: namespace is populated even though the request never
        // reached PatternResource's method body (denied by the @PermissionsAllowed
        // interceptor before any store call, and thus before any Location header).
        assertThat(entry.getString("namespace"), is("finos"));
        assertThat(entry.getString("actor"), is("test-user"));
        // No Location header was ever produced, and no path param names the new
        // (never-created) pattern's own ID — this is the accepted, documented gap.
        assertThat(entry.getString("entityId"), is(nullValue()));
    }

    @Test
    void not_record_an_entry_for_a_401_rejected_before_jaxrs_dispatch() {
        given()
                .body(PATTERN)
                .header("Content-Type", "application/json")
                .when().post("/api/calm/namespaces/finos/patterns")
                .then()
                .statusCode(401);

        // AuditRequestFilter is a JAX-RS ContainerResponseFilter, so it only ever sees
        // requests that reach RESTEasy's resource matching. An entirely unauthenticated
        // request (no bearer token at all) against the secure/OIDC profile is rejected by
        // Quarkus's OIDC authentication layer before JAX-RS dispatch begins, so no
        // ResourceInfo is ever resolved and this filter never runs. 401 is still in the
        // filter's own DENIED_STATUSES set (for the case where dispatch *did* happen and a
        // security exception was thrown afterward), but that path isn't reachable via a
        // bare unauthenticated call in this profile — empirically confirmed here rather
        // than assumed.
        MongoCollection<Document> auditLogs = database.getCollection("auditLogs");
        Document entry = auditLogs.find(new Document("entityType", "PATTERN")).first();

        assertThat(entry, is(nullValue()));
    }
}
