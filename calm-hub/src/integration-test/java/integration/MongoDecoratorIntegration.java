package integration;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoDatabase;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import org.bson.Document;
import org.finos.calm.domain.exception.DecoratorKeyRefusedException;
import org.finos.calm.domain.exception.DecoratorSupersededException;
import org.finos.calm.store.mongo.MongoDecoratorStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;

import static io.restassured.RestAssured.given;
import static integration.MongoSetup.counterSetup;
import static integration.MongoSetup.namespaceSetup;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertThrows;

@QuarkusTest
@TestProfile(IntegrationTestProfile.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class MongoDecoratorIntegration {

    private static final Logger logger = LoggerFactory.getLogger(MongoDecoratorIntegration.class);

    private static int reservedId;
    private static int successorId;
    private static int unreservedId;

    private static final String DEPLOYMENT_STANDARD =
            "https://calm.finos.org/standards/deployment/1.0/deployment.decorator.standard.json";
    private static final String BASE_DECORATOR = "https://calm.finos.org/release/1.3/meta/decorators.json#/defs/decorator";

    // Real CALM decorators have a $schema, and $-prefixed keys must stay plain data in the stored decorator.
    private static final String VALID_DECORATOR = """
            {
                "$schema": "%s",
                "unique-id": "finos-architecture-1-deployment",
                "type": "deployment",
                "target": ["/api/calm/namespaces/finos/architectures/1/versions/1-0-0"],
                "target-type": ["architecture"],
                "applies-to": ["example-node"],
                "data": {
                    "start-time": "2026-02-23T10:00:00Z",
                    "status": "in-progress",
                    "notes": "Integration test decorator",
                    "extended-json": {"$numberInt": "1", "nested": {"$maxKey": 1}},
                    "big": 123456789012345678901234567890
                }
            }
            """.formatted(DEPLOYMENT_STANDARD);

    private static final String UPDATED_DECORATOR = """
            {
                "$schema": "%s",
                "unique-id": "finos-architecture-1-deployment",
                "type": "deployment",
                "target": ["/api/calm/namespaces/finos/architectures/1/versions/1-0-0"],
                "target-type": ["architecture"],
                "applies-to": ["example-node"],
                "data": {
                    "start-time": "2026-02-23T10:00:00Z",
                    "status": "completed",
                    "notes": "Integration test decorator"
                }
            }
            """.formatted(DEPLOYMENT_STANDARD);

    @Inject
    MongoTestConnection mongoTestConnection;

    @Inject
    MongoDecoratorStore decoratorStore;

    @BeforeEach
    public void setup() {
        String mongoUri = mongoTestConnection.connectionString();
        String mongoDatabase = mongoTestConnection.database();

        if (mongoUri == null || mongoUri.isBlank()) {
            logger.error("MongoDB URI is not set. Check the EndToEndResource configuration.");
            throw new IllegalStateException("MongoDB URI is not set. Check the EndToEndResource configuration.");
        }

        try (MongoClient mongoClient = MongoClients.create(mongoUri)) {
            MongoDatabase database = mongoClient.getDatabase(mongoDatabase);

            if (!database.listCollectionNames().into(new ArrayList<>()).contains("decorators")) {
                database.createCollection("decorators");
                database.getCollection("decorators").insertOne(
                        new Document("namespace", "finos").append("decorators", new ArrayList<>())
                );
            }

            counterSetup(database);
            namespaceSetup(database);
        }
    }

    @Test
    @Order(1)
    void end_to_end_get_with_no_decorators() {
        given()
                .when().get("/api/calm/namespaces/finos/decorators")
                .then()
                .statusCode(200)
                .body("values", empty());
    }

    @Test
    @Order(2)
    void end_to_end_create_a_decorator() {
        given()
                .contentType(ContentType.JSON)
                .body(VALID_DECORATOR)
                .when().post("/api/calm/namespaces/finos/decorators")
                .then()
                .statusCode(201)
                .header("Location", containsString("/api/calm/namespaces/finos/decorators/1"))
                .body("id", equalTo(1));
    }

    @Test
    @Order(3)
    void end_to_end_list_decorators_contains_created_id() {
        given()
                .when().get("/api/calm/namespaces/finos/decorators")
                .then()
                .statusCode(200)
                .body("values", hasSize(1))
                .body("values[0]", equalTo(1));
    }

    @Test
    @Order(4)
    void end_to_end_retrieve_decorator_by_id() {
        given()
                .when().get("/api/calm/namespaces/finos/decorators/1")
                .then()
                .statusCode(200)
                .body("type", equalTo("deployment"))
                .body("uniqueId", equalTo("finos-architecture-1-deployment"))
                .body("target[0]", equalTo("/api/calm/namespaces/finos/architectures/1/versions/1-0-0"))
                .body("targetType[0]", equalTo("architecture"))
                .body("appliesTo[0]", equalTo("example-node"))
                .body("schema", equalTo(DEPLOYMENT_STANDARD))
                .body("data.'extended-json'.'$numberInt'", equalTo("1"))
                .body("data.'extended-json'.nested.'$maxKey'", equalTo(1))
                .body(containsString("\"big\":123456789012345678901234567890"));
    }

    @Test
    @Order(5)
    void end_to_end_update_decorator_by_id() {
        given()
                .when().get("/api/calm/namespaces/finos/decorators/1")
                .then()
                .statusCode(200)
                .body("data.status", equalTo("in-progress"));

        given()
                .contentType(ContentType.JSON)
                .body(UPDATED_DECORATOR)
                .when().put("/api/calm/namespaces/finos/decorators/1")
                .then()
                .statusCode(200);

        given()
                .when().get("/api/calm/namespaces/finos/decorators/1")
                .then()
                .statusCode(200)
                .body("data.status", equalTo("completed"));
    }

    @Test
    @Order(6)
    void end_to_end_retrieve_nonexistent_decorator_returns_404() {
        given()
                .when().get("/api/calm/namespaces/finos/decorators/999")
                .then()
                .statusCode(404)
                .body(containsString("Decorator with ID 999 does not exist in namespace: finos"));
    }

    @Test
    @Order(7)
    void end_to_end_supersede_a_reserved_decorator_and_keep_the_old_one_in_the_history() {
        reservedId = given()
                .contentType(ContentType.JSON)
                .body(reservedDecorator("open"))
                .when().post("/api/calm/namespaces/finos/decorators")
                .then()
                .statusCode(201)
                .extract().path("id");
        String created = given()
                .when().get("/api/calm/namespaces/finos/decorators/" + reservedId)
                .then()
                .statusCode(200)
                .body("updateDateTime", notNullValue())
                .extract().path("creationDateTime");

        successorId = given()
                .contentType(ContentType.JSON)
                .body(reservedDecorator("closed"))
                .when().put("/api/calm/namespaces/finos/decorators/" + reservedId)
                .then()
                .statusCode(201)
                .header("Location", containsString("/api/calm/namespaces/finos/decorators/"))
                .extract().path("id");

        given()
                .when().get("/api/calm/namespaces/finos/decorators/" + reservedId)
                .then()
                .statusCode(200)
                .body("data.status", equalTo("open"))
                .body("creationDateTime", equalTo(created))
                .body("updateDateTime", equalTo(created));
        String successorCreated = given()
                .when().get("/api/calm/namespaces/finos/decorators/" + successorId)
                .then()
                .statusCode(200)
                .body("data.status", equalTo("closed"))
                .body("creationDateTime", greaterThanOrEqualTo(created))
                .extract().path("creationDateTime");
        given()
                .when().get("/api/calm/namespaces/finos/decorators/" + successorId)
                .then()
                .body("updateDateTime", equalTo(successorCreated));

        given()
                .when().get("/api/calm/namespaces/finos/decorators?type=integration-evaluation")
                .then()
                .statusCode(200)
                .body("values", contains(successorId));

        given()
                .when().get("/api/calm/namespaces/finos/decorators/" + reservedId + "/history")
                .then()
                .statusCode(200)
                .body("values", hasSize(2))
                .body("values[0].id", equalTo(successorId))
                .body("values[0].supersedes", equalTo(reservedId))
                .body("values[0].supersededBy", nullValue())
                .body("values[1].id", equalTo(reservedId))
                .body("values[1].supersededBy", equalTo(successorId))
                .body("values[1].supersededDateTime", equalTo(successorCreated))
                .body("values[1].decorator.data.status", equalTo("open"))
                .body("values[0].decorator.schema", equalTo(BASE_DECORATOR));
    }

    @Test
    @Order(8)
    void end_to_end_refuse_to_supersede_a_superseded_decorator() {
        given()
                .contentType(ContentType.JSON)
                .body(reservedDecorator("reopened"))
                .when().put("/api/calm/namespaces/finos/decorators/" + reservedId)
                .then()
                .statusCode(409)
                .body(containsString("superseded"));

        given()
                .when().get("/api/calm/namespaces/finos/decorators/" + reservedId + "/history")
                .then()
                .statusCode(200)
                .body("values", hasSize(2));
    }

    @Test
    @Order(9)
    void end_to_end_return_the_whole_history_from_any_decorator_in_it() {
        int thirdId = given()
                .contentType(ContentType.JSON)
                .body(reservedDecorator("reopened"))
                .when().put("/api/calm/namespaces/finos/decorators/" + successorId)
                .then()
                .statusCode(201)
                .extract().path("id");

        given()
                .when().get("/api/calm/namespaces/finos/decorators/" + successorId + "/history")
                .then()
                .statusCode(200)
                .body("values.id", contains(thirdId, successorId, reservedId));
    }

    @Test
    @Order(10)
    void end_to_end_delete_the_whole_history_through_an_old_decorator() {
        given()
                .when().delete("/api/calm/namespaces/finos/decorators/" + reservedId)
                .then()
                .statusCode(204);

        given()
                .when().get("/api/calm/namespaces/finos/decorators/" + reservedId + "/history")
                .then()
                .statusCode(404);
        given()
                .when().get("/api/calm/namespaces/finos/decorators/" + successorId)
                .then()
                .statusCode(404);
        given()
                .when().get("/api/calm/namespaces/finos/decorators?type=integration-evaluation")
                .then()
                .statusCode(200)
                .body("values", empty());
        given()
                .when().get("/api/calm/namespaces/finos/decorators/1")
                .then()
                .statusCode(200);
    }

    @Test
    @Order(11)
    void end_to_end_refuse_an_in_place_update_of_a_superseded_decorator() {
        unreservedId = given()
                .contentType(ContentType.JSON)
                .body(VALID_DECORATOR)
                .when().post("/api/calm/namespaces/finos/decorators")
                .then()
                .statusCode(201)
                .extract().path("id");
        int reservedSuccessorId = given()
                .contentType(ContentType.JSON)
                .body(reservedDecorator("open"))
                .when().put("/api/calm/namespaces/finos/decorators/" + unreservedId)
                .then()
                .statusCode(201)
                .extract().path("id");

        given()
                .contentType(ContentType.JSON)
                .body(UPDATED_DECORATOR)
                .when().put("/api/calm/namespaces/finos/decorators/" + unreservedId)
                .then()
                .statusCode(409)
                .body(containsString("superseded"));

        given()
                .when().get("/api/calm/namespaces/finos/decorators/" + unreservedId + "/history")
                .then()
                .statusCode(200)
                .body("values.id", contains(reservedSuccessorId, unreservedId))
                .body("values[1].decorator.data.status", equalTo("in-progress"));
    }

    @Test
    @Order(12)
    void end_to_end_refuse_to_delete_a_history_whose_head_is_no_longer_current() {
        assertThrows(DecoratorSupersededException.class,
                () -> decoratorStore.deleteCurrentDecoratorHistory("finos", unreservedId));

        given()
                .when().get("/api/calm/namespaces/finos/decorators/" + unreservedId + "/history")
                .then()
                .statusCode(200)
                .body("values", hasSize(2));
    }

    @Test
    @Order(13)
    void end_to_end_refuse_a_key_with_a_nul_character() {
        given()
                .contentType(ContentType.JSON)
                .body("{\"type\": \"deployment\", \"data\": {\"a\\u0000b\": 1}}")
                .when().post("/api/calm/namespaces/finos/decorators")
                .then()
                .statusCode(400)
                .body(equalTo(DecoratorKeyRefusedException.nulCharacter().getMessage()));
    }

    private static String reservedDecorator(String status) {
        return """
                {
                    "$schema": "%s",
                    "unique-id": "finos-architecture-1-evaluation",
                    "type": "integration-evaluation",
                    "target": ["/api/calm/namespaces/finos/architectures/1/versions/1-0-0"],
                    "target-type": ["architecture"],
                    "applies-to": ["example-node"],
                    "data": {"status": "%s"}
                }
                """.formatted(BASE_DECORATOR, status);
    }
}
