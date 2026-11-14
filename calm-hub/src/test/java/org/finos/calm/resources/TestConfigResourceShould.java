package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import jakarta.json.Json;
import org.finos.calm.domain.configs.ConfigDefault;
import org.finos.calm.domain.configs.ConfigSchemaError;
import org.finos.calm.domain.configs.ConfigType;
import org.finos.calm.domain.configs.CreateConfigRequest;
import org.finos.calm.domain.configs.ResolvedConfigDefault;
import org.finos.calm.domain.exception.ConfigNotFoundException;
import org.finos.calm.domain.exception.ConfigSchemaValidationException;
import org.finos.calm.domain.exception.ConfigVersionExistsException;
import org.finos.calm.domain.exception.ConfigVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.services.ConfigService;
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
class TestConfigResourceShould {

    private static final String BASE = "/api/calm/namespaces/finos/configs/c4-mapping";
    private static final String BODY = "{\"name\":\"Acme\",\"description\":\"Acme mapping\","
            + "\"configJson\":\"{\\\"unique-id\\\":\\\"acme\\\",\\\"node-types\\\":{}}\"}";

    @InjectMock
    ConfigService mockConfigService;

    @Test
    void list_the_config_types_with_their_schemas() {
        given().get("/api/calm/config-types")
                .then()
                .statusCode(200)
                .body("values[0].type", equalTo("c4-mapping"))
                .body("values[0].schema", equalTo("https://calm.finos.org/standards/c4/1.0/c4-mapping.json"));
    }

    @Test
    void return_400_for_an_unknown_config_type_on_every_route() {
        given().get("/api/calm/namespaces/finos/configs/theme").then().statusCode(400)
                .body(containsString("Unknown config type"));
        given().get("/api/calm/namespaces/finos/configs/theme/1/versions").then().statusCode(400);
        given().get("/api/calm/namespaces/finos/configs/theme/1/versions/1.0.0").then().statusCode(400);
        given().get("/api/calm/namespaces/finos/configs/theme/default").then().statusCode(400);
        given().contentType("application/json").body(BODY)
                .post("/api/calm/namespaces/finos/configs/theme").then().statusCode(400);
        given().contentType("application/json").body(BODY)
                .post("/api/calm/namespaces/finos/configs/theme/1/versions/1.0.1").then().statusCode(400);
        given().contentType("application/json").body("{\"configId\":1,\"version\":\"1.0.0\"}")
                .put("/api/calm/namespaces/finos/configs/theme/default").then().statusCode(400);
        given().delete("/api/calm/namespaces/finos/configs/theme/default").then().statusCode(400);
        verifyNoInteractions(mockConfigService);
    }

    @Test
    void return_400_for_an_invalid_namespace_or_version() {
        given().get("/api/calm/namespaces/fin_os/configs/c4-mapping").then().statusCode(400)
                .body(containsString(NAMESPACE_MESSAGE));
        given().contentType("application/json").body(BODY)
                .post(BASE + "/1/versions/1.0.invalid0").then().statusCode(400)
                .body(containsString(VERSION_MESSAGE));
    }

    @Test
    void list_configs() throws Exception {
        when(mockConfigService.getConfigsForNamespace("finos", ConfigType.C4_MAPPING))
                .thenReturn(List.of(new NamespaceResourceSummary("Acme", "Acme mapping", 3, 2)));

        given().get(BASE).then().statusCode(200)
                .body("values[0].id", equalTo(3))
                .body("values[0].name", equalTo("Acme"))
                .body("values[0].versionCount", equalTo(2));
    }

    @Test
    void create_a_config_at_version_1_0_0() throws Exception {
        when(mockConfigService.createConfig(any(), eq("finos"), eq(ConfigType.C4_MAPPING))).thenReturn(4);

        given().contentType("application/json").body(BODY).post(BASE)
                .then().statusCode(201)
                .header("Location", containsString("/api/calm/namespaces/finos/configs/c4-mapping/4/versions/1.0.0"));
        verify(mockConfigService).createConfig(new CreateConfigRequest("Acme", "Acme mapping",
                "{\"unique-id\":\"acme\",\"node-types\":{}}"), "finos", ConfigType.C4_MAPPING);
    }

    @Test
    void return_the_schema_errors_sanitized_when_a_config_does_not_match_its_schema() throws Exception {
        when(mockConfigService.createConfig(any(), eq("finos"), eq(ConfigType.C4_MAPPING)))
                .thenThrow(new ConfigSchemaValidationException(List.of(
                        new ConfigSchemaError("/node-types/x", "<script>bad</script> is not a kind"))));

        given().contentType("application/json").body(BODY).post(BASE)
                .then().statusCode(400)
                .body("error", equalTo("Config does not match the schema of its type"))
                .body("errors[0].location", equalTo("/node-types/x"))
                .body("errors[0].error", not(containsString("<script>")));
    }

    static Stream<Arguments> versionReadFailures() {
        return Stream.of(
                Arguments.of(new NamespaceNotFoundException(), 404, "Invalid namespace"),
                Arguments.of(new ConfigNotFoundException(), 404, "Config 3 does not exist"),
                Arguments.of(new ConfigVersionNotFoundException(), 404, "Config 3 has no version 1.0.0"));
    }

    @ParameterizedTest
    @MethodSource("versionReadFailures")
    void map_read_failures_to_404(Exception failure, int status, String message) throws Exception {
        when(mockConfigService.getConfigForVersion("finos", ConfigType.C4_MAPPING, 3, "1.0.0")).thenThrow(failure);

        given().get(BASE + "/3/versions/1.0.0").then().statusCode(status).body(containsString(message));
    }

    @Test
    void return_404_for_a_missing_namespace_on_every_route() throws Exception {
        NamespaceNotFoundException missing = new NamespaceNotFoundException();
        when(mockConfigService.getConfigsForNamespace("missing", ConfigType.C4_MAPPING)).thenThrow(missing);
        when(mockConfigService.createConfig(any(), eq("missing"), eq(ConfigType.C4_MAPPING))).thenThrow(missing);
        doThrow(missing).when(mockConfigService)
                .createConfigVersion(any(), eq("missing"), eq(ConfigType.C4_MAPPING), eq(3), eq("1.0.1"));
        when(mockConfigService.resolveDefault("missing", ConfigType.C4_MAPPING)).thenThrow(missing);
        when(mockConfigService.setDefault("missing", ConfigType.C4_MAPPING, 3, "1.0.0")).thenThrow(missing);
        when(mockConfigService.deleteDefault("missing", ConfigType.C4_MAPPING)).thenThrow(missing);
        String base = "/api/calm/namespaces/missing/configs/c4-mapping";

        given().get(base).then().statusCode(404).body(containsString("Invalid namespace"));
        given().contentType("application/json").body(BODY).post(base).then().statusCode(404);
        given().contentType("application/json").body(BODY).post(base + "/3/versions/1.0.1").then().statusCode(404);
        given().get(base + "/default").then().statusCode(404).body(containsString("Invalid namespace"));
        given().contentType("application/json").body("{\"configId\":3,\"version\":\"1.0.0\"}").put(base + "/default")
                .then().statusCode(404);
        given().delete(base + "/default").then().statusCode(404).body(containsString("Invalid namespace"));
    }

    @Test
    void return_404_and_400_when_a_version_write_names_a_missing_config_or_fails_its_schema() throws Exception {
        doThrow(new ConfigNotFoundException()).when(mockConfigService)
                .createConfigVersion(any(), eq("finos"), eq(ConfigType.C4_MAPPING), eq(9), eq("1.0.1"));
        doThrow(new ConfigSchemaValidationException(List.of(new ConfigSchemaError("", "bad")))).when(mockConfigService)
                .createConfigVersion(any(), eq("finos"), eq(ConfigType.C4_MAPPING), eq(3), eq("1.0.1"));

        given().contentType("application/json").body(BODY).post(BASE + "/9/versions/1.0.1")
                .then().statusCode(404).body(containsString("Config 9 does not exist"));
        given().contentType("application/json").body(BODY).post(BASE + "/3/versions/1.0.1")
                .then().statusCode(400).body("error", equalTo("Config does not match the schema of its type"));
    }

    @Test
    void return_a_config_version_as_json() throws Exception {
        when(mockConfigService.getConfigForVersion("finos", ConfigType.C4_MAPPING, 3, "1.0.0"))
                .thenReturn("{\"unique-id\":\"acme\"}");

        given().get(BASE + "/3/versions/1.0.0").then().statusCode(200).body("unique-id", equalTo("acme"));
    }

    @Test
    void list_config_versions_and_report_a_missing_config() throws Exception {
        when(mockConfigService.getConfigVersions("finos", ConfigType.C4_MAPPING, 3)).thenReturn(List.of("1.0.0", "1.1.0"));
        when(mockConfigService.getConfigVersions("finos", ConfigType.C4_MAPPING, 9)).thenThrow(new ConfigNotFoundException());
        when(mockConfigService.getConfigVersions("missing", ConfigType.C4_MAPPING, 3)).thenThrow(new NamespaceNotFoundException());

        given().get(BASE + "/3/versions").then().statusCode(200).body("values[1]", equalTo("1.1.0"));
        given().get(BASE + "/9/versions").then().statusCode(404);
        given().get("/api/calm/namespaces/missing/configs/c4-mapping/3/versions").then().statusCode(404);
    }

    @Test
    void return_409_when_a_config_version_exists() throws Exception {
        doThrow(new ConfigVersionExistsException()).when(mockConfigService)
                .createConfigVersion(any(), eq("finos"), eq(ConfigType.C4_MAPPING), eq(3), eq("1.0.1"));

        given().contentType("application/json").body(BODY).post(BASE + "/3/versions/1.0.1")
                .then().statusCode(409);
    }

    @Test
    void create_a_config_version() throws Exception {
        given().contentType("application/json").body(BODY).post(BASE + "/3/versions/1.0.1")
                .then().statusCode(201)
                .header("Location", containsString("/configs/c4-mapping/3/versions/1.0.1"));
    }

    @Test
    void return_the_resolved_default_with_its_source_namespace_and_content() throws Exception {
        when(mockConfigService.resolveDefault("org.ab.cd", ConfigType.C4_MAPPING))
                .thenReturn(Optional.of(new ResolvedConfigDefault("c4-mapping", "org", 3, "1.1.0", true,
                        Json.createObjectBuilder().add("unique-id", "acme").build())));

        given().get("/api/calm/namespaces/org.ab.cd/configs/c4-mapping/default")
                .then().statusCode(200)
                .body("configType", equalTo("c4-mapping"))
                .body("namespace", equalTo("org"))
                .body("configId", equalTo(3))
                .body("version", equalTo("1.1.0"))
                .body("inherited", equalTo(true))
                .body("config.unique-id", equalTo("acme"));
    }

    @Test
    void return_404_when_no_default_applies() throws Exception {
        when(mockConfigService.resolveDefault("finos", ConfigType.C4_MAPPING)).thenReturn(Optional.empty());

        given().get(BASE + "/default").then().statusCode(404).body(containsString("No c4-mapping default"));
    }

    @Test
    void set_a_default() throws Exception {
        when(mockConfigService.setDefault("finos", ConfigType.C4_MAPPING, 3, "1.1.0"))
                .thenReturn(new ConfigDefault("c4-mapping", "finos", 3, "1.1.0"));

        given().contentType("application/json").body("{\"configId\":3,\"version\":\"1.1.0\"}")
                .put(BASE + "/default")
                .then().statusCode(200)
                .body("configId", equalTo(3))
                .body("version", equalTo("1.1.0"));
    }

    @Test
    void reject_a_default_without_a_config_id_or_a_valid_version() {
        given().contentType("application/json").body("{\"version\":\"1.1.0\"}").put(BASE + "/default")
                .then().statusCode(400);
        given().contentType("application/json").body("{\"configId\":3,\"version\":\"latest\"}").put(BASE + "/default")
                .then().statusCode(400);
        verifyNoInteractions(mockConfigService);
    }

    @Test
    void return_404_when_the_default_names_a_missing_config_or_version() throws Exception {
        when(mockConfigService.setDefault("finos", ConfigType.C4_MAPPING, 9, "1.0.0")).thenThrow(new ConfigNotFoundException());
        when(mockConfigService.setDefault("finos", ConfigType.C4_MAPPING, 3, "2.0.0")).thenThrow(new ConfigVersionNotFoundException());

        given().contentType("application/json").body("{\"configId\":9,\"version\":\"1.0.0\"}").put(BASE + "/default")
                .then().statusCode(404).body(containsString("Config 9 does not exist"));
        given().contentType("application/json").body("{\"configId\":3,\"version\":\"2.0.0\"}").put(BASE + "/default")
                .then().statusCode(404).body(containsString("has no version 2.0.0"));
    }

    @Test
    void delete_a_default_and_return_404_when_there_is_none() throws Exception {
        when(mockConfigService.deleteDefault("finos", ConfigType.C4_MAPPING)).thenReturn(true);
        when(mockConfigService.deleteDefault("other", ConfigType.C4_MAPPING)).thenReturn(false);

        given().delete(BASE + "/default").then().statusCode(204);
        given().delete("/api/calm/namespaces/other/configs/c4-mapping/default").then().statusCode(404);
    }
}
