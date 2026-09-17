package org.finos.calm.resources;

import static io.restassured.RestAssured.given;

import static org.finos.calm.resources.ResourceValidationConstants.NAMESPACE_MESSAGE;
import static org.finos.calm.resources.ResourceValidationConstants.VERSION_MESSAGE;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;

import org.finos.calm.domain.Document;
import org.finos.calm.domain.documents.CreateDocumentRequest;
import org.finos.calm.domain.exception.DocumentNotFoundException;
import org.finos.calm.domain.exception.DocumentVersionExistsException;
import org.finos.calm.domain.exception.DocumentVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.services.DocumentService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.List;

@QuarkusTest
@TestSecurity(authorizationEnabled = false)
class TestDocumentResourceShould {
    @InjectMock DocumentService mockDocumentStore;
    private final ObjectMapper mapper = new ObjectMapper();

    private CreateDocumentRequest request() {
        return new CreateDocumentRequest("A", "description", "---\ntitle: A\n---\n# A");
    }

    @Test
    void create_a_document_with_mapping_frontmatter() throws Exception {
        Document created = new Document(request());
        created.setId(5);
        created.setVersion("1.0.0");
        when(mockDocumentStore.createDocumentForNamespace(any(), eq("finos"), eq("knowledge")))
                .thenReturn(created);
        given().contentType("application/json")
                .body(mapper.writeValueAsString(request()))
                .post("/api/calm/namespaces/finos/documents/knowledge")
                .then()
                .statusCode(201)
                .header("Location", containsString("/documents/knowledge/5/versions/1.0.0"));
    }

    @Test
    void reject_document_without_mapping_frontmatter() throws Exception {
        CreateDocumentRequest invalid =
                new CreateDocumentRequest("A", "description", "# no frontmatter");
        given().contentType("application/json")
                .body(mapper.writeValueAsString(invalid))
                .post("/api/calm/namespaces/finos/documents/knowledge")
                .then()
                .statusCode(400);
        verifyNoInteractions(mockDocumentStore);
    }

    @Test
    void reject_unknown_document_type() throws Exception {
        given().contentType("application/json")
                .body(mapper.writeValueAsString(request()))
                .post("/api/calm/namespaces/finos/documents/unknown")
                .then()
                .statusCode(400);
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "pattern",
                "architecture",
                "interface",
                "flow",
                "control",
                "schema",
                "timeline",
                "adr"
            })
    void reject_existing_calm_resource_types(String type) throws Exception {
        given().contentType("application/json")
                .body(mapper.writeValueAsString(request()))
                .post("/api/calm/namespaces/finos/documents/" + type)
                .then()
                .statusCode(400);
    }

    @Test
    void reject_unsupported_document_type_on_read_routes() {
        given().get("/api/calm/namespaces/finos/documents/architecture")
                .then()
                .statusCode(400)
                .body(containsString("Unsupported document type"));
        given().get("/api/calm/namespaces/finos/documents/architecture/1/versions")
                .then()
                .statusCode(400)
                .body(containsString("Unsupported document type"));
        given().get("/api/calm/namespaces/finos/documents/architecture/1/versions/1.0.0")
                .then()
                .statusCode(400)
                .body(containsString("Unsupported document type"));
    }

    @Test
    void accept_sad_as_a_narrative_document_type() throws Exception {
        Document created = new Document(request());
        created.setId(5);
        when(mockDocumentStore.createDocumentForNamespace(any(), eq("finos"), eq("sad")))
                .thenReturn(created);
        given().contentType("application/json")
                .body(mapper.writeValueAsString(request()))
                .post("/api/calm/namespaces/finos/documents/sad")
                .then()
                .statusCode(201);
    }

    @Test
    void return_conflict_for_existing_version() throws Exception {
        doThrow(new DocumentVersionExistsException())
                .when(mockDocumentStore)
                .createDocumentForVersion(any(), eq("finos"), eq("knowledge"), eq(1), eq("1.0.1"));
        given().contentType("application/json")
                .body(mapper.writeValueAsString(request()))
                .post("/api/calm/namespaces/finos/documents/knowledge/1/versions/1.0.1")
                .then()
                .statusCode(409);
    }

    @Test
    void list_documents_and_versions() throws Exception {
        when(mockDocumentStore.getDocumentsForNamespace("finos", "knowledge"))
                .thenReturn(List.of(1, 2));
        when(mockDocumentStore.getDocumentVersions("finos", "knowledge", 1))
                .thenReturn(List.of("1.0.0"));
        given().get("/api/calm/namespaces/finos/documents/knowledge")
                .then()
                .statusCode(200)
                .body("values", contains(1, 2));
        given().get("/api/calm/namespaces/finos/documents/knowledge/1/versions")
                .then()
                .statusCode(200);
    }

    @Test
    void return_markdown_and_not_found_responses() throws Exception {
        when(mockDocumentStore.getDocumentForVersion("finos", "knowledge", 1, "1.0.0"))
                .thenReturn(request().getDocumentMarkdown());
        given().get("/api/calm/namespaces/finos/documents/knowledge/1/versions/1.0.0")
                .then()
                .statusCode(200)
                .contentType("application/json")
                .body("documentMarkdown", equalTo(request().getDocumentMarkdown()));
        reset(mockDocumentStore);
        doThrow(new DocumentNotFoundException())
                .when(mockDocumentStore)
                .getDocumentVersions("finos", "knowledge", 1);
        doThrow(new DocumentVersionNotFoundException())
                .when(mockDocumentStore)
                .getDocumentForVersion("finos", "knowledge", 1, "1.0.0");
        given().get("/api/calm/namespaces/finos/documents/knowledge/1/versions")
                .then()
                .statusCode(404);
        given().get("/api/calm/namespaces/finos/documents/knowledge/1/versions/1.0.0")
                .then()
                .statusCode(404);
    }

    @Test
    void create_version_and_return_invalid_namespace() throws Exception {
        given().contentType("application/json")
                .body(mapper.writeValueAsString(request()))
                .post("/api/calm/namespaces/finos/documents/knowledge/1/versions/1.0.1")
                .then()
                .statusCode(201);
        reset(mockDocumentStore);
        doThrow(new NamespaceNotFoundException())
                .when(mockDocumentStore)
                .getDocumentsForNamespace("missing", "knowledge");
        given().get("/api/calm/namespaces/missing/documents/knowledge").then().statusCode(404);
    }

    @Test
    void reject_scalar_sequence_and_malformed_frontmatter() throws Exception {
        for (String markdown :
                List.of(
                        "---\ntitle\n---\nbody",
                        "---\n- title\n---\nbody",
                        "---\n[broken\n---\nbody",
                        "---\ntitle: A\n---trailing\nbody")) {
            CreateDocumentRequest invalid = new CreateDocumentRequest("A", "description", markdown);
            given().contentType("application/json")
                    .body(mapper.writeValueAsString(invalid))
                    .post("/api/calm/namespaces/finos/documents/knowledge")
                    .then()
                    .statusCode(400);
        }
    }

    @Test
    void reject_empty_mapping_frontmatter_on_create_and_create_version() throws Exception {
        CreateDocumentRequest invalid =
                new CreateDocumentRequest("A", "description", "---\n{}\n---\nbody");
        given().contentType("application/json")
                .body(mapper.writeValueAsString(invalid))
                .post("/api/calm/namespaces/finos/documents/knowledge")
                .then()
                .statusCode(400);
        given().contentType("application/json")
                .body(mapper.writeValueAsString(invalid))
                .post("/api/calm/namespaces/finos/documents/knowledge/1/versions/1.0.1")
                .then()
                .statusCode(400);
        verifyNoInteractions(mockDocumentStore);
    }

    @Test
    void reject_null_document_markdown() throws Exception {
        CreateDocumentRequest invalid = new CreateDocumentRequest("A", "description", null);
        given().contentType("application/json")
                .body(mapper.writeValueAsString(invalid))
                .post("/api/calm/namespaces/finos/documents/knowledge")
                .then()
                .statusCode(400);
        verifyNoInteractions(mockDocumentStore);
    }

    @Test
    void return_not_found_when_creating_a_version_for_an_unknown_document() throws Exception {
        doThrow(new DocumentNotFoundException())
                .when(mockDocumentStore)
                .createDocumentForVersion(any(), eq("finos"), eq("knowledge"), eq(1), eq("1.0.1"));
        given().contentType("application/json")
                .body(mapper.writeValueAsString(request()))
                .post("/api/calm/namespaces/finos/documents/knowledge/1/versions/1.0.1")
                .then()
                .statusCode(404);
    }

    @Test
    void return_not_found_when_creating_a_document_in_an_unknown_namespace() throws Exception {
        doThrow(new NamespaceNotFoundException())
                .when(mockDocumentStore)
                .createDocumentForNamespace(any(), eq("missing"), eq("knowledge"));
        given().contentType("application/json")
                .body(mapper.writeValueAsString(request()))
                .post("/api/calm/namespaces/missing/documents/knowledge")
                .then()
                .statusCode(404);
    }

    @Test
    void return_invalid_namespace_on_remaining_document_routes() throws Exception {
        doThrow(new NamespaceNotFoundException())
                .when(mockDocumentStore)
                .getDocumentVersions("missing", "knowledge", 1);
        doThrow(new NamespaceNotFoundException())
                .when(mockDocumentStore)
                .getDocumentForVersion("missing", "knowledge", 1, "1.0.0");
        doThrow(new NamespaceNotFoundException())
                .when(mockDocumentStore)
                .createDocumentForVersion(
                        any(), eq("missing"), eq("knowledge"), eq(1), eq("1.0.1"));

        given().get("/api/calm/namespaces/missing/documents/knowledge/1/versions")
                .then()
                .statusCode(404);
        given().get("/api/calm/namespaces/missing/documents/knowledge/1/versions/1.0.0")
                .then()
                .statusCode(404);
        given().contentType("application/json")
                .body(mapper.writeValueAsString(request()))
                .post("/api/calm/namespaces/missing/documents/knowledge/1/versions/1.0.1")
                .then()
                .statusCode(404);
    }

    @Test
    void reject_invalid_namespace_and_version() {
        given().get("/api/calm/namespaces/not_valid/documents/knowledge")
                .then()
                .statusCode(400)
                .body(containsString(NAMESPACE_MESSAGE));
        given().get("/api/calm/namespaces/finos/documents/knowledge/1/versions/not-a-version")
                .then()
                .statusCode(400)
                .body(containsString(VERSION_MESSAGE));
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "/api/calm/namespaces/not_valid/documents/knowledge/1/versions",
                "/api/calm/namespaces/not_valid/documents/knowledge/1/versions/1.0.0"
            })
    void return_a_validation_message_for_invalid_namespaces_on_remaining_get_routes(String path) {
        given().get(path).then().statusCode(400).body(containsString(NAMESPACE_MESSAGE));
    }

    @Test
    void return_validation_messages_for_invalid_post_routes() throws Exception {
        given().contentType("application/json")
                .body(mapper.writeValueAsString(request()))
                .post("/api/calm/namespaces/not_valid/documents/knowledge")
                .then()
                .statusCode(400)
                .body(containsString(NAMESPACE_MESSAGE));
        given().contentType("application/json")
                .body(mapper.writeValueAsString(request()))
                .post("/api/calm/namespaces/not_valid/documents/knowledge/1/versions/1.0.1")
                .then()
                .statusCode(400)
                .body(containsString(NAMESPACE_MESSAGE));
        given().contentType("application/json")
                .body(mapper.writeValueAsString(request()))
                .post("/api/calm/namespaces/finos/documents/knowledge/1/versions/not-a-version")
                .then()
                .statusCode(400)
                .body(containsString(VERSION_MESSAGE));
    }
}
