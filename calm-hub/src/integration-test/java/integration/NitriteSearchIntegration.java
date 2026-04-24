package integration;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;

@QuarkusTest
@TestProfile(NitriteIntegrationTestProfile.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class NitriteSearchIntegration {

    @BeforeEach
    public void setup() {
        NitriteSetup.namespaceSetup();
        NitriteSetup.domainSetup();
    }

    @Test
    @Order(1)
    void end_to_end_search_returns_empty_when_no_resources() {
        given()
                .queryParam("q", "nonexistent-xyz")
                .when().get("/calm/search")
                .then()
                .statusCode(200)
                .body("architectures", hasSize(0))
                .body("patterns", hasSize(0));
    }

    @Test
    @Order(2)
    void end_to_end_create_architecture_for_search() {
        given()
                .body("""
                        {
                            "name": "Search Test Architecture",
                            "description": "Architecture for search testing",
                            "architectureJson": "{\\"nodes\\": []}"
                        }
                        """)
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/architectures")
                .then()
                .statusCode(201);
    }

    @Test
    @Order(3)
    void end_to_end_search_finds_architecture_by_name() {
        given()
                .queryParam("q", "Search Test")
                .when().get("/calm/search")
                .then()
                .statusCode(200)
                .body("architectures", hasSize(1))
                .body("architectures[0].name", equalTo("Search Test Architecture"))
                .body("architectures[0].namespace", equalTo("finos"));
    }

    @Test
    @Order(4)
    void end_to_end_search_finds_architecture_by_description() {
        given()
                .queryParam("q", "search testing")
                .when().get("/calm/search")
                .then()
                .statusCode(200)
                .body("architectures", hasSize(1))
                .body("architectures[0].name", equalTo("Search Test Architecture"));
    }

    @Test
    @Order(5)
    void end_to_end_search_is_case_insensitive() {
        given()
                .queryParam("q", "SEARCH TEST")
                .when().get("/calm/search")
                .then()
                .statusCode(200)
                .body("architectures", hasSize(1));
    }

    @Test
    @Order(6)
    void end_to_end_create_pattern_for_search() {
        given()
                .body("""
                        {
                            "name": "Search Test Pattern",
                            "description": "Pattern for search testing",
                            "patternJson": "{\\"nodes\\": []}"
                        }
                        """)
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/patterns")
                .then()
                .statusCode(201);
    }

    @Test
    @Order(7)
    void end_to_end_search_finds_pattern_by_name() {
        given()
                .queryParam("q", "Search Test Pattern")
                .when().get("/calm/search")
                .then()
                .statusCode(200)
                .body("patterns", hasSize(1))
                .body("patterns[0].name", equalTo("Search Test Pattern"))
                .body("patterns[0].namespace", equalTo("finos"));
    }

    @Test
    @Order(8)
    void end_to_end_create_control_for_search() {
        given()
                .body("""
                        {
                            "name": "Search Test Control",
                            "description": "Control for search testing",
                            "requirementJson": "{\\"type\\": \\"requirement\\"}"
                        }
                        """)
                .header("Content-Type", "application/json")
                .when().post("/calm/domains/security/controls")
                .then()
                .statusCode(201);
    }

    @Test
    @Order(9)
    void end_to_end_search_finds_control_by_name() {
        given()
                .queryParam("q", "Search Test Control")
                .when().get("/calm/search")
                .then()
                .statusCode(200)
                .body("controls", hasSize(1))
                .body("controls[0].name", equalTo("Search Test Control"))
                .body("controls[0].namespace", equalTo("security"));
    }

    @Test
    @Order(10)
    void end_to_end_search_across_multiple_resource_types() {
        given()
                .queryParam("q", "Search Test")
                .when().get("/calm/search")
                .then()
                .statusCode(200)
                .body("architectures", hasSize(1))
                .body("patterns", hasSize(1))
                .body("controls", hasSize(1));
    }
}
