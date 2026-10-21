package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import org.finos.calm.domain.Pattern;
import org.finos.calm.domain.ResourceMapping;
import org.finos.calm.domain.ResourceType;
import org.finos.calm.domain.exception.GitHubModeNotSupportedException;
import org.finos.calm.domain.exception.MappingNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.security.UserAccessValidator;
import org.finos.calm.store.ArchitectureSchema;
import org.finos.calm.store.PatternImplementationStore;
import org.finos.calm.store.PatternStore;
import org.finos.calm.store.ResourceMappingStore;
import org.finos.calm.store.util.PatternReferenceMatcher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static io.restassured.RestAssured.given;
import static org.finos.calm.resources.ResourceValidationConstants.CUSTOM_ID_MESSAGE;
import static org.finos.calm.resources.ResourceValidationConstants.NAMESPACE_MESSAGE;
import static org.finos.calm.resources.ResourceValidationConstants.SNAPSHOT_VERSION_MESSAGE;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasKey;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@TestSecurity(authorizationEnabled = false)
@QuarkusTest
class TestPatternImplementationsEndpointShould {

    private static final String PATH =
            "/calm/namespaces/finos/patterns/api-gateway/versions/1.0.0/implementations";
    private static final String PATTERN_PATH = "/calm/namespaces/finos/patterns/api-gateway/versions/";

    @InjectMock
    PatternImplementationStore mockImplementationStore;

    @InjectMock
    ResourceMappingStore mockMappingStore;

    @InjectMock
    PatternStore mockPatternStore;

    // As in TestSearchResourceShould: disabling declarative authorization does not bypass the
    // resource's own ReadableScope lookup, so an identity-less principal would otherwise resolve
    // to zero grants rather than the unrestricted Optional.empty() these tests assume.
    @InjectMock
    UserAccessValidator mockUserAccessValidator;

    @BeforeEach
    void setUp() throws Exception {
        lenient().when(mockUserAccessValidator.getReadableNamespaces(any())).thenReturn(Optional.empty());
        lenient().when(mockMappingStore.getMapping(anyString(), any(), anyString()))
                .thenReturn(mapping("api-gateway", 3));
        lenient().when(mockMappingStore.listMappingsByNumericIds(anyString(), any(), any()))
                .thenReturn(List.of());
        lenient().when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenReturn(List.of("1.0.0"));
    }

    private static ResourceMapping mapping(String customId, int numericId) {
        return new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos")
                .setCustomId(customId)
                .setResourceType(ResourceType.ARCHITECTURE)
                .setNumericId(numericId)
                .build();
    }

    /** An architecture version whose $schema names the given version of api-gateway. */
    private static ArchitectureSchema naming(String patternVersion, String namespace, int architectureId, String version) {
        return new ArchitectureSchema(namespace, architectureId, version, "https://hub.example.com" + PATTERN_PATH + patternVersion);
    }

    /** A compiled pattern has no equals, so compare its source with the one the matcher builds. */
    private static java.util.regex.Pattern isTheApiGatewayPath() {
        String expected = PatternReferenceMatcher.of("finos", "api-gateway").path().pattern();
        return argThat(path -> path != null && path.pattern().equals(expected));
    }

    private void stubCandidates(List<ArchitectureSchema> candidates) {
        when(mockImplementationStore.findSchemasContaining(isTheApiGatewayPath(), any())).thenReturn(candidates);
    }

    @Test
    void return_the_architectures_that_implement_the_pattern() {
        stubCandidates(List.of(naming("1.0.0", "finos", 7, "1.2.0")));

        given().when().get(PATH).then()
                .statusCode(200)
                .body("pattern.name", equalTo("api-gateway"))
                .body("pattern.version", equalTo("1.0.0"))
                .body("implementations", hasSize(1))
                .body("implementations[0].namespace", equalTo("finos"))
                .body("implementations[0].architectureId", equalTo(7))
                .body("implementations[0].version", equalTo("1.2.0"));
    }

    @Test
    void return_an_architecture_whose_schema_capitalises_the_type() {
        stubCandidates(List.of(new ArchitectureSchema("finos", 7, "1.2.0",
                "https://hub.example.com/calm/namespaces/finos/Patterns/api-gateway/versions/1.0.0")));

        given().when().get(PATH).then()
                .statusCode(200)
                .body("implementations", hasSize(1))
                .body("implementations[0].architectureId", equalTo(7));
    }

    @Test
    void return_an_empty_list_when_nothing_names_the_pattern() {
        stubCandidates(List.of());

        given().when().get(PATH).then()
                .statusCode(200)
                .body("implementations", hasSize(0));
    }

    @Test
    void keep_only_the_candidates_that_name_the_requested_version_in_any_spelling() {
        stubCandidates(List.of(
                naming("2.0.0", "finos", 6, "1.0.0"),
                naming("1-0-0", "finos", 7, "1.0.0"),
                naming("1.0.0-SNAPSHOT", "finos", 8, "1.0.0")));

        given().when().get(PATH).then()
                .statusCode(200)
                .body("implementations.architectureId", contains(7));
    }

    @Test
    void accept_a_version_spelled_with_dashes_and_echo_the_canonical_form() {
        stubCandidates(List.of(naming("1.0.0", "finos", 7, "1.2.0")));

        given().when().get("/calm/namespaces/finos/patterns/api-gateway/versions/1-0-0/implementations")
                .then()
                .statusCode(200)
                .body("pattern.version", equalTo("1.0.0"))
                .body("implementations", hasSize(1));
    }

    @Test
    void find_the_architectures_that_implement_a_snapshot_version() throws Exception {
        when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenReturn(List.of("1.0.0", "1.1.0-SNAPSHOT"));
        stubCandidates(List.of(naming("1.1.0-SNAPSHOT", "finos", 7, "1.0.0"), naming("1.1.0", "finos", 8, "1.0.0")));

        given().when().get("/calm/namespaces/finos/patterns/api-gateway/versions/1.1.0-SNAPSHOT/implementations")
                .then()
                .statusCode(200)
                .body("pattern.version", equalTo("1.1.0-SNAPSHOT"))
                .body("implementations.architectureId", contains(7));
    }

    @Test
    void sort_by_namespace_then_architecture_then_version_as_a_version_not_as_text() {
        stubCandidates(List.of(
                naming("1.0.0", "traderx", 2, "1.0.0"),
                naming("1.0.0", "finos", 9, "1.10.0"),
                naming("1.0.0", "finos", 9, "1.2.0"),
                naming("1.0.0", "finos", 7, "2.0.0")));

        given().when().get(PATH).then()
                .statusCode(200)
                .body("implementations.namespace", contains("finos", "finos", "finos", "traderx"))
                .body("implementations.architectureId", contains(7, 9, 9, 2))
                .body("implementations.version", contains("2.0.0", "1.2.0", "1.10.0", "1.0.0"));
    }

    @Test
    void take_a_page_after_the_other_versions_are_dropped_so_that_a_page_is_never_short() {
        stubCandidates(List.of(
                naming("1.0.0", "finos", 1, "1.0.0"),
                naming("2.0.0", "finos", 2, "1.0.0"),
                naming("1.0.0", "finos", 3, "1.0.0"),
                naming("2.0.0", "finos", 4, "1.0.0"),
                naming("1.0.0", "finos", 5, "1.0.0"),
                naming("1.0.0", "finos", 6, "1.0.0")));

        given().queryParam("limit", 2).queryParam("offset", 1)
                .when().get(PATH).then()
                .statusCode(200)
                .body("implementations.architectureId", contains(3, 5));
    }

    @Test
    void return_every_match_after_an_offset_when_there_is_no_limit() {
        stubCandidates(List.of(
                naming("1.0.0", "finos", 1, "1.0.0"),
                naming("1.0.0", "finos", 2, "1.0.0"),
                naming("1.0.0", "finos", 3, "1.0.0")));

        given().queryParam("offset", 1)
                .when().get(PATH).then()
                .statusCode(200)
                .body("implementations.architectureId", contains(2, 3));
    }

    @Test
    void reject_a_negative_offset() {
        given().queryParam("offset", -1).when().get(PATH).then().statusCode(400);
    }

    @Test
    void ask_the_store_for_the_pattern_path_in_the_readable_namespaces() {
        Optional<Set<String>> readable = Optional.of(Set.of("finos", "traderx"));
        when(mockUserAccessValidator.getReadableNamespaces(any())).thenReturn(readable);
        stubCandidates(List.of());

        given().when().get(PATH).then().statusCode(200);

        verify(mockImplementationStore).findSchemasContaining(isTheApiGatewayPath(), eq(readable));
    }

    @Test
    void fill_in_the_name_each_architecture_is_addressed_by() throws Exception {
        stubCandidates(List.of(naming("1.0.0", "finos", 7, "1.2.0")));
        when(mockMappingStore.listMappingsByNumericIds(eq("finos"), eq(ResourceType.ARCHITECTURE), any()))
                .thenReturn(List.of(mapping("trade-capture", 7)));

        given().when().get(PATH).then()
                .statusCode(200)
                .body("implementations[0].customId", equalTo("trade-capture"));
    }

    @Test
    void omit_the_name_for_an_architecture_that_never_had_one() {
        stubCandidates(List.of(naming("1.0.0", "finos", 7, "1.2.0")));

        given().when().get(PATH).then()
                .statusCode(200)
                .body("implementations[0]", not(hasKey("customId")));
    }

    @Test
    void resolve_names_in_one_lookup_per_namespace_rather_than_one_per_architecture() throws Exception {
        stubCandidates(List.of(
                naming("1.0.0", "finos", 7, "1.2.0"),
                naming("1.0.0", "finos", 8, "1.0.0"),
                naming("1.0.0", "traderx", 9, "1.0.0")));

        given().when().get(PATH).then().statusCode(200);

        verify(mockMappingStore).listMappingsByNumericIds(eq("finos"), eq(ResourceType.ARCHITECTURE), any());
        verify(mockMappingStore).listMappingsByNumericIds(eq("traderx"), eq(ResourceType.ARCHITECTURE), any());
    }

    @Test
    void ask_for_each_architecture_name_once_when_several_versions_match() throws Exception {
        stubCandidates(List.of(
                naming("1.0.0", "finos", 7, "1.0.0"),
                naming("1.0.0", "finos", 7, "1.1.0"),
                naming("1.0.0", "finos", 8, "1.0.0")));

        given().when().get(PATH).then().statusCode(200);

        ArgumentCaptor<List<Integer>> ids = ArgumentCaptor.forClass(List.class);
        verify(mockMappingStore).listMappingsByNumericIds(eq("finos"), eq(ResourceType.ARCHITECTURE), ids.capture());
        assertEquals(List.of(7, 8), ids.getValue());
    }

    @Test
    void keep_the_sorted_order_when_names_are_resolved_per_namespace() {
        // Resolving names groups the rows by namespace, which is in hash order.
        stubCandidates(List.of(
                naming("1.0.0", "gamma", 4, "1.0.0"),
                naming("1.0.0", "alpha", 3, "1.0.0"),
                naming("1.0.0", "beta", 2, "1.0.0"),
                naming("1.0.0", "alpha", 1, "1.0.0")));

        given().when().get(PATH).then()
                .statusCode(200)
                .body("implementations.architectureId", contains(1, 3, 2, 4));
    }

    @Test
    void fail_the_request_when_the_names_cannot_be_resolved() throws Exception {
        // An omitted name means the architecture never had one, so a swallowed error would
        // report every row as unnamed.
        stubCandidates(List.of(naming("1.0.0", "finos", 7, "1.2.0")));
        when(mockMappingStore.listMappingsByNumericIds(eq("finos"), eq(ResourceType.ARCHITECTURE), any()))
                .thenThrow(new RuntimeException("database unavailable"));

        given().when().get(PATH).then().statusCode(500);
    }

    @Test
    void still_answer_when_a_namespace_has_gone_since_the_match() throws Exception {
        stubCandidates(List.of(naming("1.0.0", "finos", 7, "1.2.0")));
        when(mockMappingStore.listMappingsByNumericIds(eq("finos"), eq(ResourceType.ARCHITECTURE), any()))
                .thenThrow(new NamespaceNotFoundException());

        given().when().get(PATH).then()
                .statusCode(200)
                .body("implementations", hasSize(1))
                .body("implementations[0]", not(hasKey("customId")));
    }

    @Test
    void return_404_when_the_pattern_exists_but_the_version_does_not() throws Exception {
        when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenReturn(List.of("2.0.0"));
        stubCandidates(List.of(naming("1.0.0", "finos", 7, "1.2.0")));

        given().when().get(PATH).then().statusCode(404);
    }

    @Test
    void return_404_when_the_pattern_does_not_exist() throws Exception {
        when(mockMappingStore.getMapping(anyString(), any(), anyString()))
                .thenThrow(new MappingNotFoundException());
        stubCandidates(List.of());

        given().when().get(PATH).then().statusCode(404);
    }

    @Test
    void return_501_in_github_mode_although_its_versions_are_commit_shas() throws Exception {
        // GitHub mode lists commit SHAs, so the version check alone would answer 404.
        when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenReturn(List.of("a1b2c3d"));
        when(mockImplementationStore.findSchemasContaining(any(), any()))
                .thenThrow(new GitHubModeNotSupportedException("Not available in GitHub storage mode."));

        given().when().get(PATH).then().statusCode(501);
    }

    @Test
    void reject_a_namespace_that_is_not_a_valid_namespace() {
        given().when().get("/calm/namespaces/fin_os/patterns/api-gateway/versions/1.0.0/implementations")
                .then().statusCode(400).body(containsString(NAMESPACE_MESSAGE));
    }

    @Test
    void reject_a_pattern_name_that_is_not_a_valid_identifier() {
        given().when().get("/calm/namespaces/finos/patterns/Not_Valid/versions/1.0.0/implementations")
                .then().statusCode(400).body(containsString(CUSTOM_ID_MESSAGE));
    }

    @Test
    void reject_a_version_that_is_not_a_valid_version() {
        given().when().get("/calm/namespaces/finos/patterns/api-gateway/versions/not-a-version/implementations")
                .then().statusCode(400).body(containsString(SNAPSHOT_VERSION_MESSAGE));
    }
}
