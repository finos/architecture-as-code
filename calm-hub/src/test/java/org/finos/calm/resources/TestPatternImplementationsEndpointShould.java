package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import org.finos.calm.domain.Pattern;
import org.finos.calm.domain.ResourceMapping;
import org.finos.calm.domain.ResourceType;
import org.finos.calm.domain.exception.MappingNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.implementations.PatternImplementation;
import org.finos.calm.domain.implementations.PatternImplementations;
import org.finos.calm.domain.implementations.PatternReference;
import org.finos.calm.security.UserAccessValidator;
import org.finos.calm.store.PageRequest;
import org.finos.calm.store.PatternImplementationStore;
import org.finos.calm.store.PatternStore;
import org.finos.calm.store.ResourceMappingStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static io.restassured.RestAssured.given;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasKey;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@TestSecurity(authorizationEnabled = false)
@QuarkusTest
class TestPatternImplementationsEndpointShould {

    private static final String PATH =
            "/calm/namespaces/finos/patterns/api-gateway/versions/1.0.0/implementations";

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

    private void stubImplementations(List<PatternImplementation> implementations) {
        when(mockImplementationStore.findImplementations(eq("finos"), eq("api-gateway"), eq("1.0.0"), any(), any()))
                .thenReturn(new PatternImplementations(
                        new PatternReference("finos", "api-gateway", "1.0.0"), implementations));
    }

    @Test
    void return_the_architectures_that_implement_the_pattern() {
        stubImplementations(List.of(new PatternImplementation("finos", 7, "1.2.0", null)));

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
    void return_an_empty_list_when_nothing_names_the_pattern() {
        stubImplementations(List.of());

        given().when().get(PATH).then()
                .statusCode(200)
                .body("implementations", hasSize(0));
    }

    @Test
    void fill_in_the_name_each_architecture_is_addressed_by() throws Exception {
        stubImplementations(List.of(new PatternImplementation("finos", 7, "1.2.0", null)));
        when(mockMappingStore.listMappingsByNumericIds(eq("finos"), eq(ResourceType.ARCHITECTURE), any()))
                .thenReturn(List.of(mapping("trade-capture", 7)));

        given().when().get(PATH).then()
                .statusCode(200)
                .body("implementations[0].customId", equalTo("trade-capture"));
    }

    @Test
    void omit_the_name_for_an_architecture_that_never_had_one() {
        stubImplementations(List.of(new PatternImplementation("finos", 7, "1.2.0", null)));

        given().when().get(PATH).then()
                .statusCode(200)
                .body("implementations[0]", not(hasKey("customId")));
    }

    @Test
    void resolve_names_in_one_lookup_per_namespace_rather_than_one_per_architecture() throws Exception {
        stubImplementations(List.of(
                new PatternImplementation("finos", 7, "1.2.0", null),
                new PatternImplementation("finos", 8, "1.0.0", null),
                new PatternImplementation("traderx", 9, "1.0.0", null)));

        given().when().get(PATH).then().statusCode(200);

        verify(mockMappingStore).listMappingsByNumericIds(eq("finos"), eq(ResourceType.ARCHITECTURE), any());
        verify(mockMappingStore).listMappingsByNumericIds(eq("traderx"), eq(ResourceType.ARCHITECTURE), any());
    }

    @Test
    void still_answer_when_the_namespace_disappears_while_names_are_being_resolved() throws Exception {
        stubImplementations(List.of(new PatternImplementation("finos", 7, "1.2.0", null)));
        when(mockMappingStore.listMappingsByNumericIds(eq("finos"), eq(ResourceType.ARCHITECTURE), any()))
                .thenThrow(new NamespaceNotFoundException());

        // A missing display name is not worth failing an otherwise complete answer.
        given().when().get(PATH).then()
                .statusCode(200)
                .body("implementations", hasSize(1))
                .body("implementations[0].customId", nullValue());
    }

    @Test
    void return_404_when_the_pattern_exists_but_the_version_does_not() throws Exception {
        when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenReturn(List.of("2.0.0"));

        given().when().get(PATH).then().statusCode(404);

        verify(mockImplementationStore, never()).findImplementations(anyString(), anyString(), anyString(), any(), any());
    }

    @Test
    void accept_a_version_spelled_with_dashes_and_resolve_it_to_the_canonical_form() throws Exception {
        when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenReturn(List.of("1.0.0"));
        stubImplementations(List.of(new PatternImplementation("finos", 7, "1.2.0", null)));

        // Echo back whatever version the store is handed, so the assertion tests the endpoint
        // rather than the stub.
        when(mockImplementationStore.findImplementations(eq("finos"), eq("api-gateway"), any(), any(), any()))
                .thenAnswer(call -> new PatternImplementations(
                        new PatternReference("finos", "api-gateway", call.getArgument(2)), List.of()));

        given().when().get("/calm/namespaces/finos/patterns/api-gateway/versions/1-0-0/implementations")
                .then()
                .statusCode(200)
                .body("pattern.version", equalTo("1.0.0"));

        verify(mockImplementationStore)
                .findImplementations(eq("finos"), eq("api-gateway"), eq("1.0.0"), any(), any());
    }

    @Test
    void pass_a_requested_paging_window_through_to_the_store() {
        stubImplementations(List.of());

        given().queryParam("limit", 2).queryParam("offset", 5)
                .when().get(PATH).then().statusCode(200);

        verify(mockImplementationStore)
                .findImplementations("finos", "api-gateway", "1.0.0", Optional.empty(), new PageRequest(2, 5));
    }

    @Test
    void reject_a_negative_offset() {
        given().queryParam("offset", -1).when().get(PATH).then().statusCode(400);
    }

    @Test
    void keep_the_order_the_store_returned_when_results_span_namespaces() throws Exception {
        // The store sorts so paging is stable; grouping by namespace to resolve names must not
        // reshuffle a page into hash order afterwards.
        stubImplementations(List.of(
                new PatternImplementation("alpha", 1, "1.0.0", null),
                new PatternImplementation("beta", 2, "1.0.0", null),
                new PatternImplementation("alpha", 3, "1.0.0", null),
                new PatternImplementation("gamma", 4, "1.0.0", null)));
        when(mockMappingStore.listMappingsByNumericIds(anyString(), any(), any())).thenReturn(List.of());

        given().when().get(PATH).then()
                .statusCode(200)
                .body("implementations.architectureId", contains(1, 2, 3, 4));
    }

    @Test
    void ask_for_each_architecture_name_once_when_several_versions_match() throws Exception {
        stubImplementations(List.of(
                new PatternImplementation("finos", 7, "1.0.0", null),
                new PatternImplementation("finos", 7, "1.1.0", null),
                new PatternImplementation("finos", 8, "1.0.0", null)));

        given().when().get(PATH).then().statusCode(200);

        ArgumentCaptor<List<Integer>> ids = ArgumentCaptor.forClass(List.class);
        verify(mockMappingStore).listMappingsByNumericIds(eq("finos"), eq(ResourceType.ARCHITECTURE), ids.capture());
        assertEquals(List.of(7, 8), ids.getValue());
    }

    @Test
    void return_404_when_the_pattern_does_not_exist() throws Exception {
        when(mockMappingStore.getMapping(anyString(), any(), anyString()))
                .thenThrow(new MappingNotFoundException());

        given().when().get(PATH).then().statusCode(404);

        verify(mockImplementationStore, never()).findImplementations(anyString(), anyString(), anyString(), any(), any());
    }

    @Test
    void return_404_rather_than_reveal_a_pattern_in_a_namespace_the_caller_cannot_read() {
        when(mockUserAccessValidator.getReadableNamespaces(any())).thenReturn(Optional.of(Set.of("traderx")));

        given().when().get(PATH).then().statusCode(404);

        verify(mockImplementationStore, never()).findImplementations(anyString(), anyString(), anyString(), any(), any());
    }

    @Test
    void pass_the_readable_namespaces_through_so_the_store_can_scope_the_matches() {
        Optional<Set<String>> readable = Optional.of(Set.of("finos", "traderx"));
        when(mockUserAccessValidator.getReadableNamespaces(any())).thenReturn(readable);
        stubImplementations(List.of());

        given().when().get(PATH).then().statusCode(200);

        verify(mockImplementationStore).findImplementations("finos", "api-gateway", "1.0.0", readable, PageRequest.UNPAGED);
    }

    @Test
    void reject_a_pattern_name_that_is_not_a_valid_identifier() {
        given().when().get("/calm/namespaces/finos/patterns/Not_Valid/versions/1.0.0/implementations")
                .then().statusCode(400);
    }

    @Test
    void reject_a_version_that_is_not_a_valid_version() {
        given().when().get("/calm/namespaces/finos/patterns/api-gateway/versions/not-a-version/implementations")
                .then().statusCode(400);
    }
}
