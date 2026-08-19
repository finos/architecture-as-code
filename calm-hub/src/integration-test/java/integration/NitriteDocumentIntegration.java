package integration;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import org.finos.calm.domain.documents.CreateDocumentRequest;
import org.junit.jupiter.api.*;

import java.net.URI;
import java.util.Arrays;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
@TestProfile(NitriteIntegrationTestProfile.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class NitriteDocumentIntegration {
    private static final String MARKDOWN = "---\ntitle: Nitrite Document\n---\n# Nitrite document";
    private static int documentId;

    @BeforeEach
    void setup() {
        NitriteSetup.namespaceSetup();
    }

    private static CreateDocumentRequest request(String name, String markdown) {
        return new CreateDocumentRequest(name, "Document description", markdown);
    }

    @Test @Order(1)
    void creates_a_document() {
        String location = given().contentType("application/json").body(request("Nitrite document", MARKDOWN))
                .post("/api/calm/namespaces/finos/documents/pattern").then().statusCode(201)
                .header("Location", containsString("/documents/pattern/")).extract().header("Location");
        documentId = documentId(location);
    }

    @Test @Order(2)
    void lists_and_retrieves_the_initial_version_verbatim() {
        given().get("/api/calm/namespaces/finos/documents/pattern").then().statusCode(200).body("values", contains(documentId));
        given().get("/api/calm/namespaces/finos/documents/pattern/" + documentId + "/versions")
                .then().statusCode(200).body("values", contains("1.0.0"));
        given().get("/api/calm/namespaces/finos/documents/pattern/" + documentId + "/versions/1.0.0")
                .then().statusCode(200).contentType("application/json").body("documentMarkdown", equalTo(MARKDOWN));
    }

    @Test @Order(3)
    void creates_and_orders_immutable_versions() {
        String versionTwo = "---\ntitle: Nitrite Document v2\n---\n# Nitrite document v2";
        given().contentType("application/json").body(request("Nitrite document v2", versionTwo))
                .post("/api/calm/namespaces/finos/documents/pattern/" + documentId + "/versions/1.0.10")
                .then().statusCode(201);
        given().contentType("application/json").body(request("Nitrite document v2", versionTwo))
                .post("/api/calm/namespaces/finos/documents/pattern/" + documentId + "/versions/1.0.2")
                .then().statusCode(201);
        given().contentType("application/json").body(request("Nitrite document v3", versionTwo))
                .post("/api/calm/namespaces/finos/documents/pattern/" + documentId + "/versions/2147483648.0.0")
                .then().statusCode(201);
        given().get("/api/calm/namespaces/finos/documents/pattern/" + documentId + "/versions")
                .then().statusCode(200).body("values", contains("1.0.0", "1.0.2", "1.0.10", "2147483648.0.0"));
        given().get("/api/calm/namespaces/finos/documents/pattern/" + documentId + "/versions/1.0.2")
                .then().statusCode(200).body("documentMarkdown", equalTo(versionTwo));
    }

    @Test @Order(4)
    void rejects_a_duplicate_version() {
        given().contentType("application/json").body(request("Duplicate", MARKDOWN))
                .post("/api/calm/namespaces/finos/documents/pattern/" + documentId + "/versions/1.0.2")
                .then().statusCode(409);
        given().contentType("application/json").body(request("Compact duplicate", MARKDOWN))
                .post("/api/calm/namespaces/finos/documents/pattern/" + documentId + "/versions/100")
                .then().statusCode(409);
        given().get("/api/calm/namespaces/finos/documents/pattern/" + documentId + "/versions")
                .then().statusCode(200).body("values", contains("1.0.0", "1.0.2", "1.0.10", "2147483648.0.0"));
    }

    private static int documentId(String location) {
        String[] segments = URI.create(location).getPath().split("/");
        int documents = Arrays.asList(segments).indexOf("documents");
        return Integer.parseInt(segments[documents + 2]);
    }
}
