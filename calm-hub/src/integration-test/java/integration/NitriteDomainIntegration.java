package integration;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import org.finos.calm.domain.Domain;
import org.junit.jupiter.api.*;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;

@QuarkusTest
@TestProfile(NitriteIntegrationTestProfile.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class NitriteDomainIntegration {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    public void setup() {
        NitriteSetup.domainSetup();
    }

    @Test
    @Order(1)
    void end_to_end_get_on_existing_domain() {
        given()
                .when().get("/calm/domains")
                .then()
                .statusCode(200)
                .body("values", hasItem("security"));
    }

    @Test
    @Order(2)
    void create_domain_that_doesnt_exist() throws JsonProcessingException {
        Domain domain = new Domain();
        domain.setName("finos");
        given()
                .body(objectMapper.writeValueAsString(domain))
                .header("Content-Type", "application/json")
                .when().post("/calm/domains")
                .then()
                .statusCode(201)
                .header("Location", containsString("calm/domains/finos"));
    }

    @Test
    @Order(3)
    void fails_when_creating_a_domain_the_second_time() throws JsonProcessingException {
        Domain domain = new Domain();
        domain.setName("finos");
        given()
                .body(objectMapper.writeValueAsString(domain))
                .header("Content-Type", "application/json")
                .when().post("/calm/domains")
                .then()
                .statusCode(409);
    }
}
