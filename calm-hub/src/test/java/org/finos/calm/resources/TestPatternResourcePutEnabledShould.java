package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.Pattern;
import org.finos.calm.domain.exception.PatternNotFoundException;
import org.finos.calm.store.PatternStore;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.stream.Stream;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.Mockito.when;

@QuarkusTest
@ExtendWith(MockitoExtension.class)
@TestProfile(AllowPutProfile.class)
public class TestPatternResourcePutEnabledShould {

    @InjectMock
    PatternStore mockPatternStore;

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
