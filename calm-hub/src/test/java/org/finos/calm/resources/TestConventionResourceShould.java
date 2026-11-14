package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import jakarta.json.Json;
import org.finos.calm.domain.conventions.ConventionDefault;
import org.finos.calm.domain.conventions.ConventionSchemaError;
import org.finos.calm.domain.conventions.ConventionType;
import org.finos.calm.domain.conventions.CreateConventionRequest;
import org.finos.calm.domain.conventions.ResolvedConventionDefault;
import org.finos.calm.domain.exception.ConventionNotFoundException;
import org.finos.calm.domain.exception.ConventionSchemaValidationException;
import org.finos.calm.domain.exception.ConventionVersionExistsException;
import org.finos.calm.domain.exception.ConventionVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.services.ConventionService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

import static io.restassured.RestAssured.given;
import static org.finos.calm.resources.ResourceValidationConstants.NAMESPACE_MESSAGE;
import static org.finos.calm.resources.ResourceValidationConstants.VERSION_MESSAGE;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@QuarkusTest
@TestSecurity(authorizationEnabled = false)
class TestConventionResourceShould {

    private static final String BASE = "/api/calm/namespaces/finos/conventions/c4-mapping";
    private static final String BODY = "{\"name\":\"Acme\",\"description\":\"Acme mapping\","
            + "\"conventionJson\":\"{\\\"unique-id\\\":\\\"acme\\\",\\\"node-types\\\":{}}\"}";

    @InjectMock
    ConventionService mockConventionService;

    @Test
    void list_the_convention_types_with_their_schemas() {
        given().get("/api/calm/convention-types")
                .then()
                .statusCode(200)
                .body("values[0].type", equalTo("c4-mapping"))
                .body("values[0].schema", equalTo("https://calm.finos.org/standards/c4/1.0/c4-mapping.json"));
    }

    @Test
    void return_400_for_an_unknown_convention_type_on_every_route() {
        given().get("/api/calm/namespaces/finos/conventions/theme").then().statusCode(400)
                .body(containsString("Unknown convention type"));
        given().get("/api/calm/namespaces/finos/conventions/theme/1/versions").then().statusCode(400);
        given().get("/api/calm/namespaces/finos/conventions/theme/1/versions/1.0.0").then().statusCode(400);
        given().get("/api/calm/namespaces/finos/conventions/theme/default").then().statusCode(400);
        given().contentType("application/json").body(BODY)
                .post("/api/calm/namespaces/finos/conventions/theme").then().statusCode(400);
        given().contentType("application/json").body(BODY)
                .post("/api/calm/namespaces/finos/conventions/theme/1/versions/1.0.1").then().statusCode(400);
        given().contentType("application/json").body("{\"conventionId\":1,\"version\":\"1.0.0\"}")
                .put("/api/calm/namespaces/finos/conventions/theme/default").then().statusCode(400);
        given().delete("/api/calm/namespaces/finos/conventions/theme/default").then().statusCode(400);
        verifyNoInteractions(mockConventionService);
    }

    @Test
    void return_400_for_an_invalid_namespace_or_version() {
        given().get("/api/calm/namespaces/fin_os/conventions/c4-mapping").then().statusCode(400)
                .body(containsString(NAMESPACE_MESSAGE));
        given().contentType("application/json").body(BODY)
                .post(BASE + "/1/versions/1.0.invalid0").then().statusCode(400)
                .body(containsString(VERSION_MESSAGE));
    }

    @Test
    void list_conventions() throws Exception {
        when(mockConventionService.getConventionsForNamespace("finos", ConventionType.C4_MAPPING))
                .thenReturn(List.of(new NamespaceResourceSummary("Acme", "Acme mapping", 3, 2)));

        given().get(BASE).then().statusCode(200)
                .body("values[0].id", equalTo(3))
                .body("values[0].name", equalTo("Acme"))
                .body("values[0].versionCount", equalTo(2));
    }

    @Test
    void create_a_convention_at_version_1_0_0() throws Exception {
        when(mockConventionService.createConvention(any(), eq("finos"), eq(ConventionType.C4_MAPPING))).thenReturn(4);

        given().contentType("application/json").body(BODY).post(BASE)
                .then().statusCode(201)
                .header("Location", containsString("/api/calm/namespaces/finos/conventions/c4-mapping/4/versions/1.0.0"));
        verify(mockConventionService).createConvention(new CreateConventionRequest("Acme", "Acme mapping",
                "{\"unique-id\":\"acme\",\"node-types\":{}}"), "finos", ConventionType.C4_MAPPING);
    }

    @Test
    void return_the_schema_errors_sanitized_when_a_convention_does_not_match_its_schema() throws Exception {
        when(mockConventionService.createConvention(any(), eq("finos"), eq(ConventionType.C4_MAPPING)))
                .thenThrow(new ConventionSchemaValidationException(List.of(
                        new ConventionSchemaError("/node-types/x", "<script>bad</script> is not a kind"))));

        given().contentType("application/json").body(BODY).post(BASE)
                .then().statusCode(400)
                .body("error", equalTo("Convention does not match the schema of its type"))
                .body("errors[0].location", equalTo("/node-types/x"))
                .body("errors[0].error", not(containsString("<script>")));
    }

    static Stream<Arguments> versionReadFailures() {
        return Stream.of(
                Arguments.of(new NamespaceNotFoundException(), 404, "Invalid namespace"),
                Arguments.of(new ConventionNotFoundException(), 404, "Convention 3 does not exist"),
                Arguments.of(new ConventionVersionNotFoundException(), 404, "Convention 3 has no version 1.0.0"));
    }

    @ParameterizedTest
    @MethodSource("versionReadFailures")
    void map_read_failures_to_404(Exception failure, int status, String message) throws Exception {
        when(mockConventionService.getConventionForVersion("finos", ConventionType.C4_MAPPING, 3, "1.0.0")).thenThrow(failure);

        given().get(BASE + "/3/versions/1.0.0").then().statusCode(status).body(containsString(message));
    }

    @Test
    void return_404_for_a_missing_namespace_on_every_route() throws Exception {
        NamespaceNotFoundException missing = new NamespaceNotFoundException();
        when(mockConventionService.getConventionsForNamespace("missing", ConventionType.C4_MAPPING)).thenThrow(missing);
        when(mockConventionService.createConvention(any(), eq("missing"), eq(ConventionType.C4_MAPPING))).thenThrow(missing);
        doThrow(missing).when(mockConventionService)
                .createConventionVersion(any(), eq("missing"), eq(ConventionType.C4_MAPPING), eq(3), eq("1.0.1"));
        when(mockConventionService.resolveDefault("missing", ConventionType.C4_MAPPING)).thenThrow(missing);
        when(mockConventionService.setDefault("missing", ConventionType.C4_MAPPING, 3, "1.0.0")).thenThrow(missing);
        when(mockConventionService.deleteDefault("missing", ConventionType.C4_MAPPING)).thenThrow(missing);
        String base = "/api/calm/namespaces/missing/conventions/c4-mapping";

        given().get(base).then().statusCode(404).body(containsString("Invalid namespace"));
        given().contentType("application/json").body(BODY).post(base).then().statusCode(404);
        given().contentType("application/json").body(BODY).post(base + "/3/versions/1.0.1").then().statusCode(404);
        given().get(base + "/default").then().statusCode(404).body(containsString("Invalid namespace"));
        given().contentType("application/json").body("{\"conventionId\":3,\"version\":\"1.0.0\"}").put(base + "/default")
                .then().statusCode(404);
        given().delete(base + "/default").then().statusCode(404).body(containsString("Invalid namespace"));
    }

    @Test
    void return_404_and_400_when_a_version_write_names_a_missing_convention_or_fails_its_schema() throws Exception {
        doThrow(new ConventionNotFoundException()).when(mockConventionService)
                .createConventionVersion(any(), eq("finos"), eq(ConventionType.C4_MAPPING), eq(9), eq("1.0.1"));
        doThrow(new ConventionSchemaValidationException(List.of(new ConventionSchemaError("", "bad")))).when(mockConventionService)
                .createConventionVersion(any(), eq("finos"), eq(ConventionType.C4_MAPPING), eq(3), eq("1.0.1"));

        given().contentType("application/json").body(BODY).post(BASE + "/9/versions/1.0.1")
                .then().statusCode(404).body(containsString("Convention 9 does not exist"));
        given().contentType("application/json").body(BODY).post(BASE + "/3/versions/1.0.1")
                .then().statusCode(400).body("error", equalTo("Convention does not match the schema of its type"));
    }

    @Test
    void return_a_convention_version_as_json() throws Exception {
        when(mockConventionService.getConventionForVersion("finos", ConventionType.C4_MAPPING, 3, "1.0.0"))
                .thenReturn("{\"unique-id\":\"acme\"}");

        given().get(BASE + "/3/versions/1.0.0").then().statusCode(200).body("unique-id", equalTo("acme"));
    }

    @Test
    void list_convention_versions_and_report_a_missing_convention() throws Exception {
        when(mockConventionService.getConventionVersions("finos", ConventionType.C4_MAPPING, 3)).thenReturn(List.of("1.0.0", "1.1.0"));
        when(mockConventionService.getConventionVersions("finos", ConventionType.C4_MAPPING, 9)).thenThrow(new ConventionNotFoundException());
        when(mockConventionService.getConventionVersions("missing", ConventionType.C4_MAPPING, 3)).thenThrow(new NamespaceNotFoundException());

        given().get(BASE + "/3/versions").then().statusCode(200).body("values[1]", equalTo("1.1.0"));
        given().get(BASE + "/9/versions").then().statusCode(404);
        given().get("/api/calm/namespaces/missing/conventions/c4-mapping/3/versions").then().statusCode(404);
    }

    @Test
    void return_409_when_a_convention_version_exists() throws Exception {
        doThrow(new ConventionVersionExistsException()).when(mockConventionService)
                .createConventionVersion(any(), eq("finos"), eq(ConventionType.C4_MAPPING), eq(3), eq("1.0.1"));

        given().contentType("application/json").body(BODY).post(BASE + "/3/versions/1.0.1")
                .then().statusCode(409);
    }

    @Test
    void create_a_convention_version() throws Exception {
        given().contentType("application/json").body(BODY).post(BASE + "/3/versions/1.0.1")
                .then().statusCode(201)
                .header("Location", containsString("/conventions/c4-mapping/3/versions/1.0.1"));
    }

    @Test
    void return_the_resolved_default_with_its_source_namespace_and_content() throws Exception {
        when(mockConventionService.resolveDefault("org.ab.cd", ConventionType.C4_MAPPING))
                .thenReturn(Optional.of(new ResolvedConventionDefault("c4-mapping", "org", 3, "1.1.0", true,
                        Json.createObjectBuilder().add("unique-id", "acme").build())));

        given().get("/api/calm/namespaces/org.ab.cd/conventions/c4-mapping/default")
                .then().statusCode(200)
                .body("conventionType", equalTo("c4-mapping"))
                .body("namespace", equalTo("org"))
                .body("conventionId", equalTo(3))
                .body("version", equalTo("1.1.0"))
                .body("inherited", equalTo(true))
                .body("convention.unique-id", equalTo("acme"));
    }

    @Test
    void return_404_when_no_default_applies() throws Exception {
        when(mockConventionService.resolveDefault("finos", ConventionType.C4_MAPPING)).thenReturn(Optional.empty());

        given().get(BASE + "/default").then().statusCode(404).body(containsString("No c4-mapping default"));
    }

    @Test
    void set_a_default() throws Exception {
        when(mockConventionService.setDefault("finos", ConventionType.C4_MAPPING, 3, "1.1.0"))
                .thenReturn(new ConventionDefault("c4-mapping", "finos", 3, "1.1.0"));

        given().contentType("application/json").body("{\"conventionId\":3,\"version\":\"1.1.0\"}")
                .put(BASE + "/default")
                .then().statusCode(200)
                .body("conventionId", equalTo(3))
                .body("version", equalTo("1.1.0"));
    }

    @Test
    void reject_a_default_without_a_convention_id_or_a_valid_version() {
        given().contentType("application/json").body("{\"version\":\"1.1.0\"}").put(BASE + "/default")
                .then().statusCode(400);
        given().contentType("application/json").body("{\"conventionId\":3,\"version\":\"latest\"}").put(BASE + "/default")
                .then().statusCode(400);
        verifyNoInteractions(mockConventionService);
    }

    @Test
    void return_404_when_the_default_names_a_missing_convention_or_version() throws Exception {
        when(mockConventionService.setDefault("finos", ConventionType.C4_MAPPING, 9, "1.0.0")).thenThrow(new ConventionNotFoundException());
        when(mockConventionService.setDefault("finos", ConventionType.C4_MAPPING, 3, "2.0.0")).thenThrow(new ConventionVersionNotFoundException());

        given().contentType("application/json").body("{\"conventionId\":9,\"version\":\"1.0.0\"}").put(BASE + "/default")
                .then().statusCode(404).body(containsString("Convention 9 does not exist"));
        given().contentType("application/json").body("{\"conventionId\":3,\"version\":\"2.0.0\"}").put(BASE + "/default")
                .then().statusCode(404).body(containsString("has no version 2.0.0"));
    }

    @Test
    void delete_a_default_and_return_404_when_there_is_none() throws Exception {
        when(mockConventionService.deleteDefault("finos", ConventionType.C4_MAPPING)).thenReturn(true);
        when(mockConventionService.deleteDefault("other", ConventionType.C4_MAPPING)).thenReturn(false);

        given().delete(BASE + "/default").then().statusCode(204);
        given().delete("/api/calm/namespaces/other/conventions/c4-mapping/default").then().statusCode(404);
    }
}
