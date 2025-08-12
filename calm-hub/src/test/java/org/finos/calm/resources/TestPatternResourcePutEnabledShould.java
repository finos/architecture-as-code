package org.finos.calm.resources;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.Mockito.when;

import java.util.stream.Stream;

import org.finos.calm.domain.Pattern;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.PatternNotFoundException;
import org.finos.calm.store.PatternStore;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.junit.jupiter.MockitoExtension;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;

@QuarkusTest
@ExtendWith(MockitoExtension.class)
@TestProfile(AllowPutProfile.class)
public class TestPatternResourcePutEnabledShould {

    @InjectMock
    PatternStore mockPatternStore;

    @Test
    void return_a_400_when_an_invalid_format_of_namespace_is_provided_on_create_new_pattern_version() throws NamespaceNotFoundException {
        given()
                .when()
                .header("Content-Type", "application/json")
                .body("{ \"test\": \"json\" }")
                .put("/calm/namespaces/fin_os/patterns/20/versions/1.0.1")
                .then()
                .statusCode(400)
                .body(containsString("namespace must match pattern '^[A-Za-z0-9-]+$'"));
    }

    @Test
    void return_a_400_when_an_invalid_format_of_version_is_provided_on_create_new_pattern_version() throws NamespaceNotFoundException {
        given()
                .when()
                .header("Content-Type", "application/json")
                .body("{ \"test\": \"json\" }")
                .put("/calm/namespaces/finos/patterns/20/versions/1.0invalid.1")
                .then()
                .statusCode(400)
                .body(containsString("version must match pattern '^(0|[1-9][0-9]*)[-.]?(0|[1-9][0-9]*)[-.]?(0|[1-9][0-9]*)$"));
    }

    static Stream<Arguments> provideParametersForPutPatternTests() {
        return Stream.of(
                Arguments.of( new NamespaceNotFoundException(), 404),
                Arguments.of( new PatternNotFoundException(), 404),
                Arguments.of(null, 201)
        );
    }

    @ParameterizedTest
    @MethodSource("provideParametersForPutPatternTests")
    void respond_correctly_to_put_pattern_correctly(Throwable exceptionToThrow, int expectedStatusCode) throws PatternNotFoundException, NamespaceNotFoundException {

        Pattern expectedPattern = new Pattern.PatternBuilder()
                .setNamespace("test")
                .setVersion("1.0.1")
                .setPattern("{ \"test\": \"json\" }")
                .setId(20)
                .build();

        System.out.println("TestPatterResourcePutEnabled mock: " + mockPatternStore);

        if (exceptionToThrow != null) {
            when(mockPatternStore.updatePatternForVersion(expectedPattern)).thenThrow(exceptionToThrow);
        } else {
            when(mockPatternStore.updatePatternForVersion(expectedPattern)).thenReturn(expectedPattern);
        }

        if (expectedStatusCode == 201) {
            given()
                    .header("Content-Type", "application/json")
                    .body("{ \"test\": \"json\" }")
                    .when()
                    .put("/calm/namespaces/test/patterns/20/versions/1.0.1")
                    .then()
                    .statusCode(expectedStatusCode)
                    .header("Location", containsString("/calm/namespaces/test/patterns/20/versions/1.0.1"));
        } else {
            given()
                    .header("Content-Type", "application/json")
                    .body("{ \"test\": \"json\" }")
                    .when()
                    .put("/calm/namespaces/test/patterns/20/versions/1.0.1")
                    .then()
                    .statusCode(expectedStatusCode);
        }
    }
}
