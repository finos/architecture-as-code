package org.finos.calm.resources;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.finos.calm.domain.Standard;
import org.finos.calm.domain.StandardDetails;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.StandardsStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.any;

@QuarkusTest
@ExtendWith(MockitoExtension.class)
public class TestStandardsResource {

    @InjectMock
    StandardsStore mockStandardsStore;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private Standard nist;
    private Standard finos;

    @BeforeEach
    void beforeEach() {
        nist = new Standard("nist", "NIST Standard", "{ \"test\": \"json\" }", null);
        finos = new Standard("finos", "FINOS Standard", "{ \"test\": \"json\" }", null);
    }

    @Test
    void return_a_404_when_an_invalid_namespace_is_provided_on_get_standards() throws NamespaceNotFoundException {
        when(mockStandardsStore.getStandardsForNamespace(anyString())).thenThrow(new NamespaceNotFoundException());

        given()
            .when()
            .get("/calm/namespaces/invalid/standards")
            .then()
            .statusCode(404);

        verify(mockStandardsStore).getStandardsForNamespace("invalid");
    }

    @Test
    void return_list_of_standards_response_when_valid_namespace_provided_on_get_standards() throws NamespaceNotFoundException, JsonProcessingException {
        List<StandardDetails> expectedStandards = List.of(this.nist, this.finos);

        when(mockStandardsStore.getStandardsForNamespace("valid")).thenReturn(expectedStandards);

        given()
                .when()
                .get("/calm/namespaces/valid/standards")
                .then()
                .statusCode(200)
                .body("values[0].name", equalTo("nist"))
                .body("values[0].description", equalTo("NIST Standard"))
                .body("values[1].name", equalTo("finos"))
                .body("values[1].description", equalTo("FINOS Standard"));

        verify(mockStandardsStore).getStandardsForNamespace("valid");
    }

    @Test
    void return_a_404_when_invalid_namespace_is_provided_on_create_standards() throws NamespaceNotFoundException, JsonProcessingException {
        when(mockStandardsStore.createStandardForNamespace(anyString(), any(Standard.class))).thenThrow(new NamespaceNotFoundException());

        given()
                .header("Content-Type", "application/json")
                .body(objectMapper.writeValueAsString(this.nist))
                .when()
                .post("/calm/namespaces/invalid/standards")
                .then()
                .statusCode(404);

        verify(mockStandardsStore).createStandardForNamespace("invalid", this.nist);
    }

    @Test
    void return_a_created_status_code_with_location_of_standard_when_creating_a_standard() throws NamespaceNotFoundException, JsonProcessingException {
        Standard storedNist = new Standard("nist", "NIST Standard", "{ \"test\": \"json\" }", 5);
        when(mockStandardsStore.createStandardForNamespace("valid", this.nist)).thenReturn(storedNist);

        given()
                .header("Content-Type", "application/json")
                .body(objectMapper.writeValueAsString(this.nist))
                .when()
                .post("/calm/namespaces/valid/standards")
                .then()
                .statusCode(201)
                .header("Location",  containsString(("/calm/namespaces/valid/standards/5/versions/1.0.0")));

        verify(mockStandardsStore).createStandardForNamespace("valid", this.nist);
    }
}
