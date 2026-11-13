package org.finos.calm.resources;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.hasKey;

@QuarkusTest
class TestDecoratorResourceOpenApiShould {

    private static final String DECORATORS = "paths.'/api/calm/namespaces/{namespace}/decorators'";
    private static final String DECORATOR = "paths.'/api/calm/namespaces/{namespace}/decorators/{id}'";

    @Test
    void list_the_error_responses_of_the_decorator_writes() {
        given()
                .queryParam("format", "json")
                .when().get("/q/openapi")
                .then()
                .statusCode(200)
                .body(DECORATORS + ".post.responses", hasKey("400"))
                .body(DECORATORS + ".post.responses", hasKey("403"))
                .body(DECORATORS + ".post.responses", hasKey("413"))
                .body(DECORATOR + ".put.responses", hasKey("201"))
                .body(DECORATOR + ".put.responses", hasKey("400"))
                .body(DECORATOR + ".put.responses", hasKey("409"))
                .body(DECORATOR + ".put.responses", hasKey("413"))
                .body(DECORATOR + ".delete.responses", hasKey("409"));
    }
}
