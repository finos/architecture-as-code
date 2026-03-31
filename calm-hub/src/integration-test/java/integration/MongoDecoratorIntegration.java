package integration;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoDatabase;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.restassured.http.ContentType;
import org.bson.Document;
import org.eclipse.microprofile.config.ConfigProvider;
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
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;

@QuarkusTest
@TestProfile(IntegrationTestProfile.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class MongoDecoratorIntegration {

    private static final Logger logger = LoggerFactory.getLogger(MongoDecoratorIntegration.class);

    private static final String VALID_DECORATOR = """
            {
                "unique-id": "finos-architecture-1-deployment",
                "type": "deployment",
                "target": ["/calm/namespaces/finos/architectures/1/versions/1-0-0"],
                "target-type": ["architecture"],
                "applies-to": ["example-node"],
                "data": {
                    "start-time": "2026-02-23T10:00:00Z",
                    "status": "completed",
                    "notes": "Integration test decorator"
                }
            }
            """;

    @BeforeEach
    public void setup() {
        String mongoUri = ConfigProvider.getConfig().getValue("quarkus.mongodb.connection-string", String.class);
        String mongoDatabase = ConfigProvider.getConfig().getValue("quarkus.mongodb.database", String.class);

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
                .when().get("/calm/namespaces/finos/decorators")
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
                .when().post("/calm/namespaces/finos/decorators")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/decorators/1"))
                .body("id", equalTo(1));
    }

    @Test
    @Order(3)
    void end_to_end_list_decorators_contains_created_id() {
        given()
                .when().get("/calm/namespaces/finos/decorators")
                .then()
                .statusCode(200)
                .body("values", hasSize(1))
                .body("values[0]", equalTo(1));
    }

    @Test
    @Order(4)
    void end_to_end_retrieve_decorator_by_id() {
        given()
                .when().get("/calm/namespaces/finos/decorators/1")
                .then()
                .statusCode(200)
                .body("type", equalTo("deployment"))
                .body("uniqueId", equalTo("finos-architecture-1-deployment"))
                .body("target[0]", equalTo("/calm/namespaces/finos/architectures/1/versions/1-0-0"))
                .body("targetType[0]", equalTo("architecture"))
                .body("appliesTo[0]", equalTo("example-node"));
    }

    @Test
    @Order(5)
    void end_to_end_retrieve_nonexistent_decorator_returns_404() {
        given()
                .when().get("/calm/namespaces/finos/decorators/999")
                .then()
                .statusCode(404)
                .body(containsString("Decorator with ID 999 does not exist in namespace: finos"));
    }
}
