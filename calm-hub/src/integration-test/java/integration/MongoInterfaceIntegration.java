package integration;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoDatabase;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import org.bson.Document;
import org.eclipse.microprofile.config.ConfigProvider;
import org.finos.calm.domain.interfaces.CreateInterfaceRequest;
import org.junit.jupiter.api.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

import static integration.MongoSetup.counterSetup;
import static integration.MongoSetup.namespaceSetup;
import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
@TestProfile(IntegrationTestProfile.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class MongoInterfaceIntegration {

    private static final Logger logger = LoggerFactory.getLogger(MongoInterfaceIntegration.class);

    CreateInterfaceRequest createInterfaceRequest;

    private static final String NAMESPACE = "finos";
    private static final String NAME = "TCP Port";
    private static final String DESCRIPTION = "TCP Port Interface Definition";
    private static final String INTERFACE_JSON = "{}";

    @BeforeEach
    public void setupInterfaces() {
        String mongoUri = ConfigProvider.getConfig().getValue("quarkus.mongodb.connection-string", String.class);
        String mongoDatabase = ConfigProvider.getConfig().getValue("quarkus.mongodb.database", String.class);

        if (mongoUri == null || mongoUri.isBlank()) {
            logger.error("MongoDB URI is not set. Check the EndToEndResource configuration.");
            throw new IllegalStateException("MongoDB URI is not set. Check the EndToEndResource configuration.");
        }

        try (MongoClient mongoClient = MongoClients.create(mongoUri)) {
            MongoDatabase database = mongoClient.getDatabase(mongoDatabase);

            if (!database.listCollectionNames().into(new ArrayList<>()).contains("interfaces")) {
                database.createCollection("interfaces");
                database.getCollection("interfaces").insertOne(
                        new Document("namespace", NAMESPACE).append("interfaces", new ArrayList<>())
                );
            }

            counterSetup(database);
            namespaceSetup(database);
        }

        createInterfaceRequest = new CreateInterfaceRequest(NAME, DESCRIPTION, INTERFACE_JSON);
    }

    @Test
    @Order(1)
    void end_to_end_get_with_no_interfaces() {
        given()
                .when().get("/calm/namespaces/finos/interfaces")
                .then()
                .statusCode(200)
                .body("values", empty());
    }

    @Test
    @Order(2)
    void end_to_end_create_an_interface() {
        given()
                .body(createInterfaceRequest)
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/interfaces")
                .then()
                .statusCode(201)
                .header("Location", containsString("calm/namespaces/finos/interfaces/1/versions/1.0.0"));
    }

    @Test
    @Order(3)
    void end_to_end_verify_interface_in_list() {
        Map<String, Object> expected = new HashMap<>();
        expected.put("id", 1);
        expected.put("name", NAME);
        expected.put("description", DESCRIPTION);

        given()
                .when().get("/calm/namespaces/finos/interfaces")
                .then()
                .statusCode(200)
                .body("values", hasSize(1))
                .body("values", hasItem(equalTo(expected)));
    }

    @Test
    @Order(4)
    void end_to_end_verify_versions() {
        given()
                .when().get("/calm/namespaces/finos/interfaces/1/versions")
                .then()
                .statusCode(200)
                .body("values", hasSize(1))
                .body("values[0]", equalTo("1.0.0"));
    }

    @Test
    @Order(5)
    void end_to_end_verify_interface_for_version() {
        given()
                .when().get("/calm/namespaces/finos/interfaces/1/versions/1.0.0")
                .then()
                .statusCode(200)
                .body(equalTo(INTERFACE_JSON));
    }

    @Test
    @Order(6)
    void end_to_end_create_a_new_version_for_interface() {
        CreateInterfaceRequest updatedRequest = new CreateInterfaceRequest("Updated TCP Port", "Updated Description", INTERFACE_JSON);

        given()
                .body(updatedRequest)
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/interfaces/1/versions/2.0.0")
                .then()
                .statusCode(201)
                .header("Location", containsString("calm/namespaces/finos/interfaces/1/versions/2.0.0"));
    }

    @Test
    @Order(7)
    void end_to_end_verify_new_version_retrieval() {
        given()
                .when().get("/calm/namespaces/finos/interfaces/1/versions/2.0.0")
                .then()
                .statusCode(200)
                .body(equalTo(INTERFACE_JSON));
    }

    @Test
    @Order(8)
    void end_to_end_verify_two_versions_exist() {
        given()
                .when().get("/calm/namespaces/finos/interfaces/1/versions")
                .then()
                .statusCode(200)
                .body("values", hasSize(2))
                .body("values", hasItem("1.0.0"))
                .body("values", hasItem("2.0.0"));
    }

    @Test
    @Order(9)
    void end_to_end_verify_interface_details_updated_after_new_version() {
        Map<String, Object> expected = new HashMap<>();
        expected.put("id", 1);
        expected.put("name", "Updated TCP Port");
        expected.put("description", "Updated Description");

        given()
                .when().get("/calm/namespaces/finos/interfaces")
                .then()
                .statusCode(200)
                .body("values", hasItem(equalTo(expected)));
    }

    @Test
    @Order(10)
    void end_to_end_create_duplicate_version_returns_conflict() {
        given()
                .body(createInterfaceRequest)
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/interfaces/1/versions/1.0.0")
                .then()
                .statusCode(409);
    }

    @Test
    @Order(11)
    void end_to_end_get_interface_for_invalid_namespace() {
        given()
                .when().get("/calm/namespaces/nonexistent/interfaces")
                .then()
                .statusCode(404);
    }

    @Test
    @Order(12)
    void end_to_end_get_versions_for_nonexistent_interface() {
        given()
                .when().get("/calm/namespaces/finos/interfaces/999/versions")
                .then()
                .statusCode(404);
    }

    @Test
    @Order(13)
    void end_to_end_get_nonexistent_version() {
        given()
                .when().get("/calm/namespaces/finos/interfaces/1/versions/9.9.9")
                .then()
                .statusCode(404);
    }
}
