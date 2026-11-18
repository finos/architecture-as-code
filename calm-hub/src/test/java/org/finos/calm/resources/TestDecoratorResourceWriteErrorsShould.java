package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import org.finos.calm.domain.DecoratorSchemaError;
import org.finos.calm.domain.exception.DecoratorSchemaValidationException;
import org.finos.calm.domain.exception.StorageWriteException;
import org.finos.calm.services.DecoratorWriteService;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.stream.IntStream;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

// The write service is mocked: the schema tests in TestDecoratorResourceShould skip when the
// meta-schemas are not built, and REST delete never makes the real service refuse a reserved type.
@TestSecurity(authorizationEnabled = false)
@QuarkusTest
class TestDecoratorResourceWriteErrorsShould {

    private static final String DECORATOR_JSON = "{\"type\": \"deployment\", \"data\": {}}";

    @InjectMock
    DecoratorWriteService decoratorWriteService;

    @Test
    void return_400_with_the_errors_when_create_does_not_match_its_schema() throws Exception {
        when(decoratorWriteService.createDecorator(any(), eq("finos"), anyString()))
                .thenThrow(new DecoratorSchemaValidationException(List.of(
                        new DecoratorSchemaError("/data/status", "must be one of the enum values"))));

        given()
                .contentType(ContentType.JSON)
                .body(DECORATOR_JSON)
                .when()
                .post("/api/calm/namespaces/finos/decorators")
                .then()
                .statusCode(400)
                .body("error", equalTo("Decorator does not match its $schema"))
                .body("errors.location", contains("/data/status"))
                .body("errors.error", contains("must be one of the enum values"));
    }

    @Test
    void return_the_first_20_schema_errors_and_the_count_of_the_rest() throws Exception {
        when(decoratorWriteService.createDecorator(any(), eq("finos"), anyString()))
                .thenThrow(new DecoratorSchemaValidationException(IntStream.range(0, 23)
                        .mapToObj(i -> new DecoratorSchemaError("/target-type/" + i, "must be one of the enum values")).toList()));

        given()
                .contentType(ContentType.JSON)
                .body(DECORATOR_JSON)
                .when()
                .post("/api/calm/namespaces/finos/decorators")
                .then()
                .statusCode(400)
                .body("errors", hasSize(20))
                .body("errors[19].location", equalTo("/target-type/19"))
                .body("moreErrors", equalTo(3));
    }

    @Test
    void return_400_with_the_errors_when_update_does_not_match_its_schema() throws Exception {
        when(decoratorWriteService.updateDecorator(any(), eq("finos"), eq(1), anyString()))
                .thenThrow(new DecoratorSchemaValidationException(List.of(
                        new DecoratorSchemaError("/target-type", "required property is missing"))));

        given()
                .contentType(ContentType.JSON)
                .body(DECORATOR_JSON)
                .when()
                .put("/api/calm/namespaces/finos/decorators/1")
                .then()
                .statusCode(400)
                .body("error", equalTo("Decorator does not match its $schema"))
                .body("errors.location", contains("/target-type"))
                .body("errors.error", contains("required property is missing"))
                .body("moreErrors", nullValue());
    }

    @Test
    void return_413_when_a_supersede_meets_the_storage_capacity() throws Exception {
        when(decoratorWriteService.updateDecorator(any(), eq("finos"), eq(1), anyString()))
                .thenThrow(StorageWriteException.capacityExceeded(new RuntimeException("too large")));

        given()
                .contentType(ContentType.JSON)
                .body(DECORATOR_JSON)
                .when()
                .put("/api/calm/namespaces/finos/decorators/1")
                .then()
                .statusCode(413)
                .body(containsString("maximum storage size"));
    }

    @Test
    void return_500_when_a_decorator_write_fails_for_another_reason() throws Exception {
        when(decoratorWriteService.updateDecorator(any(), eq("finos"), eq(1), anyString()))
                .thenThrow(StorageWriteException.writeFailed(new RuntimeException("write failed")));

        given()
                .contentType(ContentType.JSON)
                .body(DECORATOR_JSON)
                .when()
                .put("/api/calm/namespaces/finos/decorators/1")
                .then()
                .statusCode(500)
                .body(containsString("storage error"));
    }
}
