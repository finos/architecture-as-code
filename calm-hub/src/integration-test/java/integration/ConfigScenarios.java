package integration;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.oneOf;

/**
 * Config scenarios shared by the MongoDB and NitriteDB suites. Each test uses its own namespace tree, so the tests
 * do not depend on order.
 */
abstract class ConfigScenarios {

    private static final String MAPPING = "{\"unique-id\":\"%s\",\"node-types\":{\"aws:lambda\":\"container\"}}";

    @BeforeEach
    void createNamespaces() {
        for (String namespace : new String[]{"cfg-a", "cfg-a.ab", "cfg-a.ab.cd", "cfg-b", "cfg-b.ab", "cfg-c"}) {
            given().contentType("application/json")
                    .body(Map.of("name", namespace, "description", "Config scenarios"))
                    .post("/api/calm/namespaces")
                    .then().statusCode(oneOf(201, 409));
        }
    }

    @Test
    void create_read_and_version_a_config() {
        int id = create("cfg-c", "c4");
        String base = "/api/calm/namespaces/cfg-c/configs/c4-mapping/" + id;

        given().contentType("application/json").body(body("v2"))
                .post(base + "/versions/1.1.0").then().statusCode(201);
        given().contentType("application/json").body(body("again"))
                .post(base + "/versions/1.1.0").then().statusCode(409);

        given().get(base + "/versions").then().statusCode(200).body("values", contains("1.0.0", "1.1.0"));
        given().get(base + "/versions/1.0.0").then().statusCode(200).body("unique-id", equalTo("c4"));
        given().get(base + "/versions/1.1.0").then().statusCode(200).body("unique-id", equalTo("v2"));
        given().get("/api/calm/namespaces/cfg-c/configs/c4-mapping").then().statusCode(200)
                .body("values.id", hasItem(id));
    }

    @Test
    void refuse_an_unknown_type_and_a_config_that_fails_its_schema() {
        given().contentType("application/json").body(body("x"))
                .post("/api/calm/namespaces/cfg-c/configs/theme").then().statusCode(400);
        given().contentType("application/json")
                .body(Map.of("name", "bad", "configJson", "{\"unique-id\":\"bad\",\"node-types\":{\"service\":\"microservice\"}}"))
                .post("/api/calm/namespaces/cfg-c/configs/c4-mapping")
                .then().statusCode(400)
                .body("errors.location", hasItem(containsString("/node-types/service")));
    }

    @Test
    void resolve_the_nearest_default_up_three_levels_and_fall_back_when_one_is_removed() {
        int root = create("cfg-a", "root");
        int middle = create("cfg-a.ab", "middle");
        setDefault("cfg-a", root, "1.0.0");

        given().get("/api/calm/namespaces/cfg-a.ab.cd/configs/c4-mapping/default").then().statusCode(200)
                .body("namespace", equalTo("cfg-a"))
                .body("inherited", equalTo(true))
                .body("config.unique-id", equalTo("root"));

        setDefault("cfg-a.ab", middle, "1.0.0");
        given().get("/api/calm/namespaces/cfg-a.ab.cd/configs/c4-mapping/default").then().statusCode(200)
                .body("namespace", equalTo("cfg-a.ab"))
                .body("configId", equalTo(middle))
                .body("config.unique-id", equalTo("middle"));
        given().get("/api/calm/namespaces/cfg-a.ab/configs/c4-mapping/default").then().statusCode(200)
                .body("inherited", equalTo(false));

        given().delete("/api/calm/namespaces/cfg-a.ab/configs/c4-mapping/default").then().statusCode(204);
        given().get("/api/calm/namespaces/cfg-a.ab.cd/configs/c4-mapping/default").then().statusCode(200)
                .body("namespace", equalTo("cfg-a"));
    }

    @Test
    void return_404_when_no_namespace_in_the_chain_sets_a_default() {
        given().get("/api/calm/namespaces/cfg-b.ab/configs/c4-mapping/default").then().statusCode(404);
        given().get("/api/calm/namespaces/cfg-missing/configs/c4-mapping/default").then().statusCode(404);
    }

    @Test
    void refuse_a_default_that_names_a_config_of_another_namespace_or_a_missing_version() {
        int other = create("cfg-c", "other");

        given().contentType("application/json").body(Map.of("configId", other, "version", "1.0.0"))
                .put("/api/calm/namespaces/cfg-b/configs/c4-mapping/default").then().statusCode(404);
        given().contentType("application/json").body(Map.of("configId", other, "version", "9.0.0"))
                .put("/api/calm/namespaces/cfg-c/configs/c4-mapping/default").then().statusCode(404);
    }

    @Test
    void refuse_to_delete_a_namespace_that_holds_a_config() {
        create("cfg-b.ab", "blocks-delete");

        given().delete("/api/calm/namespaces/cfg-b.ab").then().statusCode(409);
    }

    private static int create(String namespace, String uniqueId) {
        String location = given().contentType("application/json").body(body(uniqueId))
                .post("/api/calm/namespaces/" + namespace + "/configs/c4-mapping")
                .then().statusCode(201)
                .extract().header("Location");
        String[] segments = URI.create(location).getPath().split("/");
        return Integer.parseInt(segments[segments.length - 3]);
    }

    private static void setDefault(String namespace, int id, String version) {
        given().contentType("application/json").body(Map.of("configId", id, "version", version))
                .put("/api/calm/namespaces/" + namespace + "/configs/c4-mapping/default")
                .then().statusCode(200)
                .body("namespace", equalTo(namespace));
    }

    private static Map<String, String> body(String uniqueId) {
        return Map.of("name", uniqueId, "description", "A C4 mapping", "configJson", String.format(MAPPING, uniqueId));
    }
}
