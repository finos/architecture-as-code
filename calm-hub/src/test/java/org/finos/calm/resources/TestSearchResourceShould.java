package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.finos.calm.domain.search.GroupedSearchResults;
import org.finos.calm.domain.search.SearchResult;
import org.finos.calm.store.SearchStore;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@QuarkusTest
@ExtendWith(MockitoExtension.class)
public class TestSearchResourceShould {

    @InjectMock
    SearchStore searchStore;

    @Test
    void return_400_when_query_is_missing() {
        given()
                .when()
                .get("/calm/search")
                .then()
                .statusCode(400)
                .body(containsString("Query parameter 'q' is required"));

        verify(searchStore, never()).search(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void return_400_when_query_is_blank() {
        given()
                .queryParam("q", "   ")
                .when()
                .get("/calm/search")
                .then()
                .statusCode(400)
                .body(containsString("Query parameter 'q' is required"));

        verify(searchStore, never()).search(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void return_400_when_query_exceeds_200_characters() {
        String longQuery = "a".repeat(201);

        given()
                .queryParam("q", longQuery)
                .when()
                .get("/calm/search")
                .then()
                .statusCode(400)
                .body(containsString("must not exceed 200 characters"));

        verify(searchStore, never()).search(org.mockito.ArgumentMatchers.any());
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

        when(searchStore.search("test")).thenReturn(results);

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

        verify(searchStore).search("test");
    }

    @Test
    void return_empty_grouped_results_when_no_matches() {
        GroupedSearchResults results = new GroupedSearchResults(
                List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of()
        );

        when(searchStore.search("nonexistent")).thenReturn(results);

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

        verify(searchStore).search("nonexistent");
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

        when(searchStore.search("demo")).thenReturn(results);

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

        verify(searchStore).search("demo");
    }

    @Test
    void accept_query_with_exactly_200_characters() {
        String maxQuery = "a".repeat(200);

        GroupedSearchResults results = new GroupedSearchResults(
                List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of()
        );

        when(searchStore.search(maxQuery)).thenReturn(results);

        given()
                .queryParam("q", maxQuery)
                .when()
                .get("/calm/search")
                .then()
                .statusCode(200);

        verify(searchStore).search(maxQuery);
    }

    @Test
    void return_500_when_search_store_throws_exception() {
        when(searchStore.search("error")).thenThrow(new RuntimeException("Database connection failed"));

        given()
                .queryParam("q", "error")
                .when()
                .get("/calm/search")
                .then()
                .statusCode(500)
                .body(containsString("An unexpected error occurred"));

        verify(searchStore).search("error");
    }
}
