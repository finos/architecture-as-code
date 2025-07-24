package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.finos.calm.domain.controls.ControlDetail;
import org.finos.calm.domain.exception.DomainNotFoundException;
import org.finos.calm.store.ControlStore;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@QuarkusTest
@ExtendWith(MockitoExtension.class)
public class TestControlResourceShould {

    private static final String INVALID_DOMAIN = "invalid-domain";
    private static final String VALID_DOMAIN = "valid-domain";

    @InjectMock
    ControlStore controlStore;

    @Test
    void return_404_when_domain_does_not_exist() {
        when(controlStore.getControlsForDomain(INVALID_DOMAIN)).thenThrow(new DomainNotFoundException(INVALID_DOMAIN));

        given()
                .when()
                .get("/calm/domains/" + INVALID_DOMAIN + "/controls")
                .then()
                .statusCode(404);

        verify(controlStore).getControlsForDomain(INVALID_DOMAIN);
    }

    @Test
    void return_a_list_of_control_details_for_a_domain() {
        ControlDetail controlDetail = new ControlDetail(1, "Control Name", "Control Description");
        when(controlStore.getControlsForDomain(VALID_DOMAIN)).thenReturn(List.of(controlDetail));

        given()
                .when()
                .get("/calm/domains/" + VALID_DOMAIN + "/controls")
                .then()
                .statusCode(200)
                .body("[0].id", equalTo(controlDetail.getId()))
                .body("[0].name", equalTo(controlDetail.getName()))
                .body("[0].description", equalTo(controlDetail.getDescription()));

        verify(controlStore).getControlsForDomain(VALID_DOMAIN);
    }
}
