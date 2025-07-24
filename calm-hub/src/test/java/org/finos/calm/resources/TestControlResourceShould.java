package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.finos.calm.domain.exception.DomainNotFoundException;
import org.finos.calm.store.ControlStore;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import static io.restassured.RestAssured.given;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@QuarkusTest
@ExtendWith(MockitoExtension.class)
public class TestControlResourceShould {

    private static final String INVALID_DOMAIN = "invalid-domain";

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

    //return an empty list of controls
}
