package integration;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import org.bson.Document;
import org.eclipse.microprofile.config.ConfigProvider;
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

/**
 * End-to-end verification that a real mutating HTTP call produces a correctly-populated
 * {@code auditLogs} document, exercising the full stack: {@code AuditRequestFilter} →
 * {@code AuditService} → {@code MongoAuditLogStore}. {@code calm.auth.enabled=false}
 * (via {@link IntegrationTestProfile}), so every call here succeeds — the DENIED-path
 * fidelity (the design's flagged risk) is covered separately by
 * {@link MongoAuditLogDeniedIntegration}, which needs a real permission denial.
 */
@QuarkusTest
@TestProfile(IntegrationTestProfile.class)
public class MongoAuditLogIntegration {

    private static final Logger logger = LoggerFactory.getLogger(MongoAuditLogIntegration.class);
    private static final String ARCHITECTURE = """
            {
                 "name": "name",
                 "description": "description",
                 "architectureJson": "{\\"name\\": \\"demo-architecture\\"}"
            }
            """;

    private MongoClient mongoClient;
    private MongoDatabase database;

    @BeforeEach
    public void setup() {
        String mongoUri = ConfigProvider.getConfig().getValue("quarkus.mongodb.connection-string", String.class);
        String mongoDatabaseName = ConfigProvider.getConfig().getValue("quarkus.mongodb.database", String.class);

        if (mongoUri == null || mongoUri.isBlank()) {
            logger.error("MongoDB URI is not set. Check the EndToEndResource configuration.");
            throw new IllegalStateException("MongoDB URI is not set. Check the EndToEndResource configuration.");
        }

        mongoClient = MongoClients.create(mongoUri);
        database = mongoClient.getDatabase(mongoDatabaseName);

        if (!database.listCollectionNames().into(new ArrayList<>()).contains("architectures")) {
            database.createCollection("architectures");
            // Collection only — no per-namespace document. That priming belonged to the old
            // one-document-per-namespace shape; under the header/version shape it has no id
            // field, so the header reader surfaces it as a resource named "<Type> null".
        }

        counterSetup(database);
        namespaceSetup(database);
        database.getCollection("auditLogs").deleteMany(new Document());
    }

    @AfterEach
    public void tearDown() {
        if (mongoClient != null) {
            mongoClient.close();
        }
    }

    @Test
    void record_a_success_audit_entry_for_architecture_creation_via_location_header_fallback() {
        given()
                .body(ARCHITECTURE)
                .header("Content-Type", "application/json")
                .when().post("/api/calm/namespaces/finos/architectures")
                .then()
                .statusCode(201);

        MongoCollection<Document> auditLogs = database.getCollection("auditLogs");
        Document entry = auditLogs.find(new Document("entityType", "ARCHITECTURE")).first();

        assertThat(entry, is(notNullValue()));
        assertThat(entry.getString("namespace"), is("finos"));
        assertThat(entry.getString("action"), is("CREATE"));
        assertThat(entry.getString("outcome"), is("SUCCESS"));
        assertThat(entry.getString("entityId"), is(notNullValue()));
        assertThat(entry.getString("version"), is("1.0.0"));
    }

    @Test
    void record_a_grant_audit_entry_for_user_access_creation() {
        given()
                .body("{\"username\":\"alice\",\"permission\":\"read\"}")
                .header("Content-Type", "application/json")
                .when().post("/api/calm/namespaces/finos/user-access")
                .then()
                .statusCode(201);

        MongoCollection<Document> auditLogs = database.getCollection("auditLogs");
        Document entry = auditLogs.find(new Document("entityType", "USER_ACCESS")).first();

        assertThat(entry, is(notNullValue()));
        assertThat(entry.getString("namespace"), is("finos"));
        assertThat(entry.getString("action"), is("GRANT"));
        assertThat(entry.getString("outcome"), is("SUCCESS"));
    }
}
