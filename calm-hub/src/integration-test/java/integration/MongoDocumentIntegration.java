package integration;

import static integration.MongoSetup.namespaceSetup;

import static io.restassured.RestAssured.given;

import static org.hamcrest.Matchers.*;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoDatabase;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;

import org.eclipse.microprofile.config.ConfigProvider;
import org.finos.calm.domain.documents.CreateDocumentRequest;
import org.junit.jupiter.api.*;

import java.net.URI;
import java.util.Arrays;

@QuarkusTest
@TestProfile(IntegrationTestProfile.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class MongoDocumentIntegration {
    private static final String NAMESPACE = "finos";
    private static final String TYPE = "knowledge";
    private static final String MARKDOWN = "---\ntitle: Mongo Document\n---\n# Mongo document";
    private static int documentId;

    @BeforeAll
    static void setup() {
        String uri =
                ConfigProvider.getConfig()
                        .getValue("quarkus.mongodb.connection-string", String.class);
        String databaseName =
                ConfigProvider.getConfig().getValue("quarkus.mongodb.database", String.class);
        try (MongoClient client = MongoClients.create(uri)) {
            MongoDatabase database = client.getDatabase(databaseName);
            // Keep the application-created unique compound index while clearing test data.
            database.getCollection("documents").deleteMany(new org.bson.Document());
            namespaceSetup(database);
        }
    }

    private static CreateDocumentRequest request(String name, String markdown) {
        return new CreateDocumentRequest(name, "Document description", markdown);
    }

    @Test
    @Order(1)
    void lists_no_documents_initially() {
        given().get("/api/calm/namespaces/finos/documents/knowledge")
                .then()
                .statusCode(200)
                .body("values", empty());
    }

    @Test
    @Order(2)
    void creates_a_document() {
        String location =
                given().contentType("application/json")
                        .body(request("Mongo document", MARKDOWN))
                        .post("/api/calm/namespaces/finos/documents/knowledge")
                        .then()
                        .statusCode(201)
                        .header("Location", containsString("/documents/knowledge/"))
                        .extract()
                        .header("Location");
        documentId = documentId(location);
        given().get("/api/calm/namespaces/finos/documents/knowledge")
                .then()
                .statusCode(200)
                .body("values", contains(documentId));
    }

    @Test
    @Order(3)
    void retrieves_the_initial_version_verbatim() {
        given().get("/api/calm/namespaces/finos/documents/knowledge/" + documentId + "/versions")
                .then()
                .statusCode(200)
                .body("values", contains("1.0.0"));
        given().get(
                        "/api/calm/namespaces/finos/documents/knowledge/"
                                + documentId
                                + "/versions/1.0.0")
                .then()
                .statusCode(200)
                .contentType("application/json")
                .body("documentMarkdown", equalTo(MARKDOWN));
    }

    @Test
    @Order(4)
    void creates_and_orders_immutable_versions() {
        String versionTwo = "---\ntitle: Mongo Document v2\n---\n# Mongo document v2";
        given().contentType("application/json")
                .body(request("Mongo document v2", versionTwo))
                .post(
                        "/api/calm/namespaces/finos/documents/knowledge/"
                                + documentId
                                + "/versions/1.0.10")
                .then()
                .statusCode(201);
        given().contentType("application/json")
                .body(request("Mongo document v2", versionTwo))
                .post(
                        "/api/calm/namespaces/finos/documents/knowledge/"
                                + documentId
                                + "/versions/1.0.2")
                .then()
                .statusCode(201);
        given().contentType("application/json")
                .body(request("Mongo document v3", versionTwo))
                .post(
                        "/api/calm/namespaces/finos/documents/knowledge/"
                                + documentId
                                + "/versions/2147483648.0.0")
                .then()
                .statusCode(201);
        given().get("/api/calm/namespaces/finos/documents/knowledge/" + documentId + "/versions")
                .then()
                .statusCode(200)
                .body("values", contains("1.0.0", "1.0.2", "1.0.10", "2147483648.0.0"));
        given().get(
                        "/api/calm/namespaces/finos/documents/knowledge/"
                                + documentId
                                + "/versions/1.0.2")
                .then()
                .statusCode(200)
                .body("documentMarkdown", equalTo(versionTwo));
    }

    @Test
    @Order(5)
    void rejects_a_duplicate_version() {
        given().contentType("application/json")
                .body(request("Duplicate", MARKDOWN))
                .post(
                        "/api/calm/namespaces/finos/documents/knowledge/"
                                + documentId
                                + "/versions/1.0.2")
                .then()
                .statusCode(409);
        given().contentType("application/json")
                .body(request("Compact duplicate", MARKDOWN))
                .post(
                        "/api/calm/namespaces/finos/documents/knowledge/"
                                + documentId
                                + "/versions/100")
                .then()
                .statusCode(409);
        given().get("/api/calm/namespaces/finos/documents/knowledge/" + documentId + "/versions")
                .then()
                .statusCode(200)
                .body("values", contains("1.0.0", "1.0.2", "1.0.10", "2147483648.0.0"));
    }

    private static int documentId(String location) {
        String[] segments = URI.create(location).getPath().split("/");
        int documents = Arrays.asList(segments).indexOf("documents");
        return Integer.parseInt(segments[documents + 2]);
    }
}
