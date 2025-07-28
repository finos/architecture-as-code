package org.finos.calm.resources;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import org.finos.calm.domain.Architecture;
import org.finos.calm.domain.architecture.ArchitectureRequest;
import org.finos.calm.domain.exception.ArchitectureNotFoundException;
import org.finos.calm.domain.exception.ArchitectureVersionExistsException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.ArchitectureStore;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.stream.Stream;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@QuarkusTest
@ExtendWith(MockitoExtension.class)
@TestProfile(AllowPutProfile.class)
public class TestArchitectureResourcePutEnabledShould {

    private static final String ARCHITECTURE_NAME = "architecture-name";
    private static final String ARCHITECTURE_DESCRIPTION = "architecture description";
    private static final String ARCHITECTURE_JSON = "{ \"test\": \"json\" }";
    private final ObjectMapper objectMapper = new ObjectMapper();
    @InjectMock
    ArchitectureStore mockArchitectureStore;

    @Test
    void return_a_400_when_an_invalid_format_of_namespace_is_provided_on_create_new_architecture_version() throws NamespaceNotFoundException {
        given()
                .when()
                .header("Content-Type", "application/json")
                .body(ARCHITECTURE_JSON)
                .put("/calm/namespaces/fin_os/architectures/20/versions/1.0.1")
                .then()
                .statusCode(400)
                .body(containsString("namespace must match pattern '^[A-Za-z0-9-]+$'"));
    }

    @Test
    void return_a_400_when_an_invalid_format_of_version_is_provided_on_create_new_architecture_version() throws NamespaceNotFoundException {
        given()
                .when()
                .header("Content-Type", "application/json")
                .body(ARCHITECTURE_JSON)
                .put("/calm/namespaces/finos/architectures/20/versions/1.0invalid.1")
                .then()
                .statusCode(400)
                .body(containsString("version must match pattern '^(0|[1-9][0-9]*)[-.]?(0|[1-9][0-9]*)[-.]?(0|[1-9][0-9]*)$"));
    }


    static Stream<Arguments> provideParametersForCreateArchitectureTests() {
        return Stream.of(
                Arguments.of(new NamespaceNotFoundException(), 404),
                Arguments.of(new ArchitectureNotFoundException(), 404),
                Arguments.of(null, 201)
        );
    }

    @ParameterizedTest
    @MethodSource("provideParametersForCreateArchitectureTests")
    void respond_correctly_to_create_architecture(Throwable exceptionToThrow, int expectedStatusCode) throws ArchitectureNotFoundException, ArchitectureVersionExistsException, NamespaceNotFoundException, JsonProcessingException {
        Architecture expectedArchitecture = new Architecture.ArchitectureBuilder()
                .setNamespace("test")
                .setVersion("1.0.1")
                .setArchitecture(ARCHITECTURE_JSON)
                .setId(20)
                .setName(ARCHITECTURE_NAME)
                .setDescription(ARCHITECTURE_DESCRIPTION)
                .build();

        ArchitectureRequest architectureRequest = new ArchitectureRequest();
        architectureRequest.setArchitectureJson(ARCHITECTURE_JSON);
        architectureRequest.setName(ARCHITECTURE_NAME);
        architectureRequest.setDescription(ARCHITECTURE_DESCRIPTION);

        if (exceptionToThrow != null) {
            when(mockArchitectureStore.updateArchitectureForVersion(expectedArchitecture)).thenThrow(exceptionToThrow);
        } else {
            when(mockArchitectureStore.updateArchitectureForVersion(expectedArchitecture)).thenReturn(expectedArchitecture);
        }

        if (expectedStatusCode == 201) {
            given()
                    .header("Content-Type", "application/json")
                    .body(objectMapper.writeValueAsString(architectureRequest))
                    .when()
                    .put("/calm/namespaces/test/architectures/20/versions/1.0.1")
                    .then()
                    .statusCode(expectedStatusCode)
                    //Derived from stubbed architecture in resource
                    .header("Location", containsString("/calm/namespaces/test/architectures/20/versions/1.0.1"));
        } else {
            given()
                    .header("Content-Type", "application/json")
                    .body(objectMapper.writeValueAsString(architectureRequest))
                    .when()
                    .put("/calm/namespaces/test/architectures/20/versions/1.0.1")
                    .then()
                    .statusCode(expectedStatusCode);
        }

        verify(mockArchitectureStore, times(1)).updateArchitectureForVersion(expectedArchitecture);
    }

}
