package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import org.finos.calm.domain.Flow;
import org.finos.calm.domain.exception.FlowNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.FlowStore;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.stream.Stream;

import static io.restassured.RestAssured.given;
import static org.finos.calm.resources.ResourceValidationConstants.VERSION_MESSAGE;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.Mockito.when;

@QuarkusTest
@ExtendWith(MockitoExtension.class)
@TestProfile(AllowPutProfile.class)
public class TestFlowResourcePutEnabledShould {

    @InjectMock
    FlowStore mockFlowStore;

    @Test
    void return_400_error_when_version_is_not_valid_when_updating_flow_version() {
        String flowJson = "{ \"test\": \"json\" }";

        given()
                .header("Content-Type", "application/json")
                .body(flowJson)
                .when()
                .put("/calm/namespaces/test/flows/20/versions/invalid-version")
                .then()
                .statusCode(400)
                .body(containsString(VERSION_MESSAGE));
    }

    static Stream<Arguments> provideParametersForPutFlowTests() {
        return Stream.of(
                Arguments.of( new NamespaceNotFoundException(), 404),
                Arguments.of( new FlowNotFoundException(), 404),
                Arguments.of(null, 201)
        );
    }

    @ParameterizedTest
    @MethodSource("provideParametersForPutFlowTests")
    void respond_correctly_to_put_flow_correctly(Throwable exceptionToThrow, int expectedStatusCode) throws FlowNotFoundException, NamespaceNotFoundException {

        Flow expectedFlow = new Flow.FlowBuilder()
                .setNamespace("test")
                .setVersion("1.0.1")
                .setFlow("{ \"test\": \"json\" }")
                .setId(20)
                .build();

        if (exceptionToThrow != null) {
            when(mockFlowStore.updateFlowForVersion(expectedFlow)).thenThrow(exceptionToThrow);
        } else {
            when(mockFlowStore.updateFlowForVersion(expectedFlow)).thenReturn(expectedFlow);
        }

        if (expectedStatusCode == 201) {
            given()
                    .header("Content-Type", "application/json")
                    .body("{ \"test\": \"json\" }")
                    .when()
                    .put("/calm/namespaces/test/flows/20/versions/1.0.1")
                    .then()
                    .statusCode(expectedStatusCode)
                    .header("Location", containsString("/calm/namespaces/test/flows/20/versions/1.0.1"));
        } else {
            given()
                    .header("Content-Type", "application/json")
                    .body("{ \"test\": \"json\" }")
                    .when()
                    .put("/calm/namespaces/test/flows/20/versions/1.0.1")
                    .then()
                    .statusCode(expectedStatusCode);
        }
    }
}
