package integration;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import org.junit.jupiter.api.*;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
@TestProfile(NitriteIntegrationTestProfile.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class NitriteTimelineIntegration {

    public static final String TIMELINE = "{\"moments\": []}";
    public static final String TIMELINE_V2 = "{\"moments\": [{\"unique-id\": \"1.0.0\"}]}";

    private static int createdTimelineId;

    @BeforeEach
    public void setup() {
        NitriteSetup.namespaceSetup();
    }

    @Test
    @Order(1)
    void end_to_end_get_with_no_timeline() {
        given()
                .when().get("/calm/namespaces/finos/timelines")
                .then()
                .statusCode(200)
                .body("values", empty());
    }

    @Test
    @Order(2)
    void end_to_end_create_a_timeline() {
        String payload = """
                {
                     "name": "name",
                     "description": "description",
                     "timelineJson": "{\\"moments\\": []}"
                }
                """;

        String location = given()
                .body(payload)
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/timelines")
                .then()
                .statusCode(201)
                .header("Location", containsString("calm/namespaces/finos/timelines/"))
                .extract().header("Location");

        int timelinesIdx = location.indexOf("/timelines/") + "/timelines/".length();
        String idStr = location.substring(timelinesIdx);
        if (idStr.contains("/")) {
            idStr = idStr.substring(0, idStr.indexOf('/'));
        }
        createdTimelineId = Integer.parseInt(idStr);
    }

    @Test
    @Order(3)
    void end_to_end_verify_versions() {
        given()
                .when().get("/calm/namespaces/finos/timelines/" + createdTimelineId + "/versions")
                .then()
                .statusCode(200)
                .body("values", hasSize(1))
                .body("values[0]", equalTo("1.0.0"));
    }

    @Test
    @Order(4)
    void end_to_end_verify_timeline() {
        given()
                .when().get("/calm/namespaces/finos/timelines/" + createdTimelineId + "/versions/1.0.0")
                .then()
                .statusCode(200)
                .body(equalTo(TIMELINE));
    }

    @Test
    @Order(5)
    void end_to_end_create_new_version() {
        String envelope = "{\"name\": \"name-v2\", \"description\": \"desc-v2\", \"timelineJson\": \"" + TIMELINE_V2.replace("\"", "\\\"") + "\"}";

        given()
                .body(envelope)
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/timelines/" + createdTimelineId + "/versions/2.0.0")
                .then()
                .statusCode(201)
                .header("Location", containsString("calm/namespaces/finos/timelines/" + createdTimelineId + "/versions/2.0.0"));

        given()
                .when().get("/calm/namespaces/finos/timelines/" + createdTimelineId + "/versions/2.0.0")
                .then()
                .statusCode(200)
                .body(equalTo(TIMELINE_V2));
    }
}
