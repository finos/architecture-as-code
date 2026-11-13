package integration;

import io.restassured.specification.RequestSpecification;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;

/**
 * Personal namespace scenarios under proxy-auth, shared by the MongoDB and NitriteDB suites.
 * Each test uses its own principals, so the tests do not depend on order.
 */
abstract class PersonalNamespacesScenarios {

    private static final String ME = "/api/calm/me/namespace";

    private static RequestSpecification as(String user) {
        return given().header("Remote-User", user);
    }

    @Test
    void create_a_personal_namespace_once() {
        as("pn-alice").when().get(ME)
                .then().statusCode(200)
                .body("name", equalTo("users.pn-alice"))
                .body("exists", equalTo(false))
                .body("owned", equalTo(false));

        as("pn-alice").when().put(ME).then().statusCode(201);
        as("pn-alice").when().put(ME).then().statusCode(200);

        as("pn-alice").when().get(ME)
                .then().statusCode(200)
                .body("exists", equalTo(true))
                .body("owned", equalTo(true));
    }

    @Test
    void keep_a_personal_namespace_private_until_the_owner_grants_access() {
        as("pn-carol").when().put(ME).then().statusCode(201);

        as("pn-carol").when().get("/api/calm/namespaces/users.pn-carol/patterns").then().statusCode(200);
        as("pn-dave").when().get("/api/calm/namespaces/users.pn-carol/patterns").then().statusCode(403);
        as("pn-carol").when().get("/api/calm/namespaces").then().body("values.name", hasItem("users.pn-carol"));
        as("pn-dave").when().get("/api/calm/namespaces").then()
                .body("values.name", not(hasItem("users.pn-carol")))
                .body("values.name", hasItem("users"));

        as("pn-carol")
                .contentType("application/json")
                .body("{\"username\":\"pn-dave\",\"permission\":\"read\",\"namespace\":\"users.pn-carol\"}")
                .when().post("/api/calm/namespaces/users.pn-carol/user-access")
                .then().statusCode(201);

        as("pn-dave").when().get("/api/calm/namespaces/users.pn-carol/patterns").then().statusCode(200);
    }

    @Test
    void refuse_a_namespace_taken_by_another_principal() {
        as("pn.erin").when().put(ME).then().statusCode(201);

        as("pn-erin").when().put(ME).then().statusCode(409);
        as("pn-erin").when().get(ME)
                .then().statusCode(200)
                .body("name", equalTo("users.pn-erin"))
                .body("exists", equalTo(true))
                .body("owned", equalTo(false));
        as("pn-erin").when().get("/api/calm/namespaces/users.pn-erin/patterns").then().statusCode(403);
    }

    @Test
    void reject_a_personal_namespace_from_the_general_create_endpoint() {
        as("pn-frank")
                .contentType("application/json")
                .body("{\"name\":\"users.pn-frank\",\"description\":\"not through me\"}")
                .when().post("/api/calm/namespaces")
                .then().statusCode(400);
    }

    @Test
    void let_the_owner_create_a_namespace_below_their_own() {
        as("pn-jo").when().put(ME).then().statusCode(201);

        as("pn-jo")
                .contentType("application/json")
                .body("{\"name\":\"users.pn-jo.drafts\",\"description\":\"drafts\"}")
                .when().post("/api/calm/namespaces")
                .then().statusCode(201);
        as("pn-kim").when().get("/api/calm/namespaces/users.pn-jo.drafts/patterns").then().statusCode(403);
    }

    @Test
    void return_422_for_a_principal_that_cannot_be_a_segment() {
        as("pn grace").when().get(ME).then().statusCode(422);
        as("pn grace").when().put(ME).then().statusCode(422);
    }
}
