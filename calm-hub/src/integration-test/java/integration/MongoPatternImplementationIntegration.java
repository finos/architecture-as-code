package integration;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoDatabase;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import jakarta.inject.Inject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import static integration.MongoSetup.counterSetup;
import static integration.MongoSetup.namespaceSetup;
import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;

/**
 * Sends the {@code content.$schema} regex through the Java driver to a real MongoDB. A mocked
 * collection cannot show that the driver accepts a filter on a {@code $}-prefixed field, or that
 * the server matches the version spellings the expression lists.
 */
@QuarkusTest
@TestProfile(IntegrationTestProfile.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class MongoPatternImplementationIntegration {

    private static final String PATTERN_PATH = "/calm/namespaces/finos/patterns/impl-pattern/versions/";
    private static final String IMPLEMENTATIONS = PATTERN_PATH + "1.0.0/implementations";

    @Inject
    MongoTestConnection mongoTestConnection;

    @BeforeEach
    public void setup() {
        try (MongoClient mongoClient = MongoClients.create(mongoTestConnection.connectionString())) {
            MongoDatabase database = mongoClient.getDatabase(mongoTestConnection.database());
            counterSetup(database);
            namespaceSetup(database);
        }
    }

    private static void post(String path, String body) {
        given().body(body).header("Content-Type", "application/json")
                .when().post(path)
                .then().statusCode(201);
    }

    private static void architecture(String name, String schema) {
        String path = "/calm/namespaces/finos/architectures/" + name + "/versions/1.0.0";
        post(path, "{\"title\": \"" + name + "\", \"$schema\": \"" + schema + "\", \"$id\": \"http://localhost:8080" + path + "\", \"nodes\": []}");
    }

    @Test
    @Order(1)
    void create_a_pattern_and_architectures_that_do_and_do_not_name_it() {
        post(PATTERN_PATH + "1.0.0", "{\"title\": \"Impl Pattern\", \"$id\": \"http://localhost:8080" + PATTERN_PATH + "1.0.0\"}");
        post(PATTERN_PATH + "2.0.0", "{\"title\": \"Impl Pattern\", \"$id\": \"http://localhost:8080" + PATTERN_PATH + "2.0.0\"}");

        architecture("impl-first", "https://hub.example.com" + PATTERN_PATH + "1-0-0");
        architecture("impl-second", "http://localhost:8080" + PATTERN_PATH + "1.0.0");
        architecture("impl-other-version", "http://localhost:8080" + PATTERN_PATH + "2.0.0");
        architecture("impl-meta-schema", "https://calm.finos.org/release/1.2/meta/calm.json");
    }

    @Test
    @Order(2)
    void return_every_architecture_that_names_the_pattern_version_in_any_spelling() {
        given().when().get(IMPLEMENTATIONS)
                .then().statusCode(200)
                .body("pattern.version", equalTo("1.0.0"))
                .body("implementations.customId", contains("impl-first", "impl-second"));
    }

    @Test
    @Order(3)
    void return_one_page_of_the_matches() {
        given().queryParam("limit", 1).queryParam("offset", 1)
                .when().get(IMPLEMENTATIONS)
                .then().statusCode(200)
                .body("implementations.customId", contains("impl-second"));
    }

    @Test
    @Order(4)
    void return_404_for_a_pattern_version_that_does_not_exist() {
        given().when().get(PATTERN_PATH + "3.0.0/implementations")
                .then().statusCode(404)
                .body(containsString("Pattern version not found"));
    }
}
