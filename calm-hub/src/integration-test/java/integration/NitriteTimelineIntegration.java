package integration;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import org.junit.jupiter.api.*;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
@TestProfile(NitriteIntegrationTestProfile.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class NitriteTimelineIntegration {

    public static final String TIMELINE = "{\"moments\": []}";
    public static final String TIMELINE_V2 = "{\"moments\": [{\"unique-id\": \"1.0.0\"}]}";

    private static final Pattern TIMELINE_ID_PATTERN = Pattern.compile("/timelines/(\\d+)");

    private static int createdTimelineId;

    @BeforeEach
    public void setup() {
        NitriteSetup.namespaceSetup();
    }

    @Test
    @Order(1)
    void end_to_end_get_with_no_timeline() {
        given()
                .when().get("/api/calm/namespaces/finos/timelines")
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
                .when().post("/api/calm/namespaces/finos/timelines")
                .then()
                .statusCode(201)
                .header("Location", containsString("calm/namespaces/finos/timelines/"))
                .extract().header("Location");

        Matcher matcher = TIMELINE_ID_PATTERN.matcher(location);
        if (!matcher.find()) {
            throw new IllegalStateException("Could not extract timeline ID from Location header: " + location);
        }
        createdTimelineId = Integer.parseInt(matcher.group(1));
    }

    @Test
    @Order(3)
    void end_to_end_verify_versions() {
        given()
                .when().get("/api/calm/namespaces/finos/timelines/" + createdTimelineId + "/versions")
                .then()
                .statusCode(200)
                .body("values", hasSize(1))
                .body("values[0]", equalTo("1.0.0"));
    }

    @Test
    @Order(4)
    void end_to_end_verify_timeline() {
        given()
                .when().get("/api/calm/namespaces/finos/timelines/" + createdTimelineId + "/versions/1.0.0")
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
                .when().post("/api/calm/namespaces/finos/timelines/" + createdTimelineId + "/versions/2.0.0")
                .then()
                .statusCode(201)
                .header("Location", containsString("calm/namespaces/finos/timelines/" + createdTimelineId + "/versions/2.0.0"));

        given()
                .when().get("/api/calm/namespaces/finos/timelines/" + createdTimelineId + "/versions/2.0.0")
                .then()
                .statusCode(200)
                .body(equalTo(TIMELINE_V2));
    }

    @Test
    @Order(6)
    void end_to_end_reject_malformed_json_on_versioned_post() {
        String envelope = "{\"name\": \"n\", \"description\": \"d\", \"timelineJson\": \"{ not json\"}";

        given()
                .body(envelope)
                .header("Content-Type", "application/json")
                .when().post("/api/calm/namespaces/finos/timelines/" + createdTimelineId + "/versions/9.0.0")
                .then()
                .statusCode(400)
                .body(containsString("could not be parsed"));
    }

    @Test
    @Order(7)
    void end_to_end_reject_malformed_json_on_versioned_put() {
        String envelope = "{\"name\": \"n\", \"description\": \"d\", \"timelineJson\": \"{ not json\"}";

        given()
                .body(envelope)
                .header("Content-Type", "application/json")
                .when().put("/api/calm/namespaces/finos/timelines/" + createdTimelineId + "/versions/1.0.0")
                .then()
                .statusCode(400)
                .body(containsString("could not be parsed"));
    }
}
