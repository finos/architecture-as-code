package integration;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.hasItem;

@QuarkusTest
@TestProfile(NitriteIntegrationTestProfile.class)
public class NitriteNamespaceIntegration {

    @BeforeEach
    public void setup() {
        NitriteSetup.namespaceSetup();
    }

    @Test
    void end_to_end_confirmation_of_namespaces() {
        given()
                .when().get("/calm/namespaces")
                .then()
                .statusCode(200)
                .body("values.name", hasItem("finos"))
                .body("values.description", hasItem("FINOS namespace"));
    }
}
