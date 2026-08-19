package org.finos.calm.resources;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import org.finos.calm.domain.Document;
import org.finos.calm.domain.documents.CreateDocumentRequest;
import org.finos.calm.domain.exception.DocumentVersionExistsException;
import org.finos.calm.domain.exception.DocumentNotFoundException;
import org.finos.calm.domain.exception.DocumentVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.services.DocumentService;
import org.junit.jupiter.api.Test;
import java.util.List;
import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@QuarkusTest
@TestSecurity(authorizationEnabled = false)
class TestDocumentResourceShould {
    @InjectMock DocumentService mockDocumentStore;
    private final ObjectMapper mapper = new ObjectMapper();
    private CreateDocumentRequest request() { return new CreateDocumentRequest("A", "description", "---\ntitle: A\n---\n# A"); }

    @Test void create_a_document_with_mapping_frontmatter() throws Exception {
        Document created = new Document(request()); created.setId(5); created.setVersion("1.0.0");
        when(mockDocumentStore.createDocumentForNamespace(any(), eq("finos"), eq("pattern"))).thenReturn(created);
        given().contentType("application/json").body(mapper.writeValueAsString(request())).post("/api/calm/namespaces/finos/documents/pattern")
                .then().statusCode(201).header("Location", containsString("/documents/pattern/5/versions/1.0.0"));
    }
    @Test void reject_document_without_mapping_frontmatter() throws Exception {
        CreateDocumentRequest invalid = new CreateDocumentRequest("A", "description", "# no frontmatter");
        given().contentType("application/json").body(mapper.writeValueAsString(invalid)).post("/api/calm/namespaces/finos/documents/pattern").then().statusCode(400);
        verifyNoInteractions(mockDocumentStore);
    }
    @Test void reject_unknown_document_type() throws Exception {
        given().contentType("application/json").body(mapper.writeValueAsString(request())).post("/api/calm/namespaces/finos/documents/unknown").then().statusCode(400);
    }
    @Test void return_conflict_for_existing_version() throws Exception {
        doThrow(new DocumentVersionExistsException()).when(mockDocumentStore).createDocumentForVersion(any(),eq("finos"),eq("pattern"),eq(1),eq("1.0.1"));
                given().contentType("application/json").body(mapper.writeValueAsString(request())).post("/api/calm/namespaces/finos/documents/pattern/1/versions/1.0.1").then().statusCode(409);
    }
    @Test void list_documents_and_versions() throws Exception {
        when(mockDocumentStore.getDocumentsForNamespace("finos", "pattern")).thenReturn(List.of(1, 2));
        when(mockDocumentStore.getDocumentVersions("finos", "pattern", 1)).thenReturn(List.of("1.0.0"));
        given().get("/api/calm/namespaces/finos/documents/pattern").then().statusCode(200).body("values", contains(1, 2));
        given().get("/api/calm/namespaces/finos/documents/pattern/1/versions").then().statusCode(200);
    }
    @Test void return_markdown_and_not_found_responses() throws Exception {
        when(mockDocumentStore.getDocumentForVersion("finos", "pattern", 1, "1.0.0")).thenReturn(request().getDocumentMarkdown());
        given().get("/api/calm/namespaces/finos/documents/pattern/1/versions/1.0.0").then().statusCode(200).contentType("application/json").body("documentMarkdown", equalTo(request().getDocumentMarkdown()));
        reset(mockDocumentStore);
        doThrow(new DocumentNotFoundException()).when(mockDocumentStore).getDocumentVersions("finos", "pattern", 1);
        doThrow(new DocumentVersionNotFoundException()).when(mockDocumentStore).getDocumentForVersion("finos", "pattern", 1, "1.0.0");
        given().get("/api/calm/namespaces/finos/documents/pattern/1/versions").then().statusCode(404);
        given().get("/api/calm/namespaces/finos/documents/pattern/1/versions/1.0.0").then().statusCode(404);
    }
    @Test void create_version_and_return_invalid_namespace() throws Exception {
        given().contentType("application/json").body(mapper.writeValueAsString(request())).post("/api/calm/namespaces/finos/documents/pattern/1/versions/1.0.1").then().statusCode(201);
        reset(mockDocumentStore);
        doThrow(new NamespaceNotFoundException()).when(mockDocumentStore).getDocumentsForNamespace("missing", "pattern");
        given().get("/api/calm/namespaces/missing/documents/pattern").then().statusCode(404);
    }
    @Test void reject_scalar_sequence_and_malformed_frontmatter() throws Exception {
        for (String markdown : List.of("---\ntitle\n---\nbody", "---\n- title\n---\nbody", "---\n[broken\n---\nbody", "---\ntitle: A\n---trailing\nbody")) {
            CreateDocumentRequest invalid = new CreateDocumentRequest("A", "description", markdown);
            given().contentType("application/json").body(mapper.writeValueAsString(invalid)).post("/api/calm/namespaces/finos/documents/pattern").then().statusCode(400);
        }
    }
    @Test void reject_empty_mapping_frontmatter_on_create_and_create_version() throws Exception {
        CreateDocumentRequest invalid = new CreateDocumentRequest("A", "description", "---\n{}\n---\nbody");
        given().contentType("application/json").body(mapper.writeValueAsString(invalid)).post("/api/calm/namespaces/finos/documents/pattern").then().statusCode(400);
        given().contentType("application/json").body(mapper.writeValueAsString(invalid)).post("/api/calm/namespaces/finos/documents/pattern/1/versions/1.0.1").then().statusCode(400);
        verifyNoInteractions(mockDocumentStore);
    }
    @Test void return_not_found_when_creating_a_version_for_an_unknown_document() throws Exception {
        doThrow(new DocumentNotFoundException()).when(mockDocumentStore).createDocumentForVersion(any(), eq("finos"), eq("pattern"), eq(1), eq("1.0.1"));
        given().contentType("application/json").body(mapper.writeValueAsString(request())).post("/api/calm/namespaces/finos/documents/pattern/1/versions/1.0.1").then().statusCode(404);
    }
    @Test void return_not_found_when_creating_a_document_in_an_unknown_namespace() throws Exception {
        doThrow(new NamespaceNotFoundException()).when(mockDocumentStore).createDocumentForNamespace(any(), eq("missing"), eq("pattern"));
        given().contentType("application/json").body(mapper.writeValueAsString(request())).post("/api/calm/namespaces/missing/documents/pattern").then().statusCode(404);
    }
    @Test void reject_invalid_namespace_and_version() {
        given().get("/api/calm/namespaces/not_valid/documents/pattern").then().statusCode(400);
        given().get("/api/calm/namespaces/finos/documents/pattern/1/versions/not-a-version").then().statusCode(400);
    }
}
