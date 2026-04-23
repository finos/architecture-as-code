package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.finos.calm.domain.search.GroupedSearchResults;
import org.finos.calm.domain.search.SearchResult;
import org.finos.calm.store.SearchStore;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Stream;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@QuarkusTest
@ExtendWith(MockitoExtension.class)
public class TestSearchResourceShould {

    @InjectMock
    SearchStore mockSearchStore;

    static Stream<Arguments> provideInvalidQueryParameters() {
        return Stream.of(
                Arguments.of(null, "Query parameter 'q' is required"),
                Arguments.of("   ", "Query parameter 'q' is required"),
                Arguments.of("a".repeat(201), "must not exceed 200 characters")
        );
    }

    @ParameterizedTest
    @MethodSource("provideInvalidQueryParameters")
    void return_400_for_invalid_query(String query, String expectedMessage) {
        var request = given();
        if (query != null) {
            request = request.queryParam("q", query);
        }

        request
                .when()
                .get("/calm/search")
                .then()
                .statusCode(400)
                .body(containsString(expectedMessage));

        verify(mockSearchStore, never()).search(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.any());
    }

    @Test
    void return_grouped_results_for_valid_query() {
        GroupedSearchResults results = new GroupedSearchResults(
                List.of(new SearchResult("finos", 1, "Test Architecture", "A test architecture")),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of()
        );

        when(mockSearchStore.search(eq("test"), any())).thenReturn(results);

        given()
                .queryParam("q", "test")
                .when()
                .get("/calm/search")
                .then()
                .statusCode(200)
                .body("architectures", hasSize(1))
                .body("architectures[0].name", equalTo("Test Architecture"))
                .body("architectures[0].namespace", equalTo("finos"))
                .body("architectures[0].id", equalTo(1))
                .body("patterns", hasSize(0))
                .body("flows", hasSize(0))
                .body("standards", hasSize(0))
                .body("interfaces", hasSize(0))
                .body("controls", hasSize(0))
                .body("adrs", hasSize(0));

        verify(mockSearchStore).search(eq("test"), eq(Optional.<Set<String>>empty()));
    }

    @Test
    void return_empty_grouped_results_when_no_matches() {
        GroupedSearchResults results = new GroupedSearchResults(
                List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of()
        );

        when(mockSearchStore.search(eq("nonexistent"), any())).thenReturn(results);

        given()
                .queryParam("q", "nonexistent")
                .when()
                .get("/calm/search")
                .then()
                .statusCode(200)
                .body("architectures", hasSize(0))
                .body("patterns", hasSize(0))
                .body("flows", hasSize(0))
                .body("standards", hasSize(0))
                .body("interfaces", hasSize(0))
                .body("controls", hasSize(0))
                .body("adrs", hasSize(0));

        verify(mockSearchStore).search(eq("nonexistent"), any());
    }

    @Test
    void return_results_from_multiple_resource_types() {
        GroupedSearchResults results = new GroupedSearchResults(
                List.of(new SearchResult("finos", 1, "Demo Architecture", "demo desc")),
                List.of(new SearchResult("finos", 2, "Demo Pattern", "pattern desc")),
                List.of(new SearchResult("finos", 3, "Demo Flow", "flow desc")),
                List.of(),
                List.of(),
                List.of(new SearchResult("api-threats", 1, "Demo Control", "control desc")),
                List.of()
        );

        when(mockSearchStore.search(eq("demo"), any())).thenReturn(results);

        given()
                .queryParam("q", "demo")
                .when()
                .get("/calm/search")
                .then()
                .statusCode(200)
                .body("architectures", hasSize(1))
                .body("patterns", hasSize(1))
                .body("flows", hasSize(1))
                .body("controls", hasSize(1));

        verify(mockSearchStore).search(eq("demo"), any());
    }

    @Test
    void accept_query_with_exactly_200_characters() {
        String maxQuery = "a".repeat(200);

        GroupedSearchResults results = new GroupedSearchResults(
                List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of()
        );

        when(mockSearchStore.search(eq(maxQuery), any())).thenReturn(results);

        given()
                .queryParam("q", maxQuery)
                .when()
                .get("/calm/search")
                .then()
                .statusCode(200);

        verify(mockSearchStore).search(eq(maxQuery), any());
    }

    @Test
    void return_500_when_search_store_throws_exception() {
        when(mockSearchStore.search(eq("error"), any())).thenThrow(new RuntimeException("Database connection failed"));

        given()
                .queryParam("q", "error")
                .when()
                .get("/calm/search")
                .then()
                .statusCode(500)
                .body(containsString("An unexpected error occurred"));

        verify(mockSearchStore).search(eq("error"), any());
    }
}
