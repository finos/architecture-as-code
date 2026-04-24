package integration;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoDatabase;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import org.eclipse.microprofile.config.ConfigProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import static io.restassured.RestAssured.given;
import static integration.MongoSetup.counterSetup;
import static integration.MongoSetup.domainSetup;
import static integration.MongoSetup.namespaceSetup;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;

@QuarkusTest
@TestProfile(IntegrationTestProfile.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class MongoSearchIntegration {

    private static final Logger logger = LoggerFactory.getLogger(MongoSearchIntegration.class);

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
            counterSetup(database);
            namespaceSetup(database);
            domainSetup(database);
        }
    }

    @Test
    @Order(1)
    void end_to_end_search_returns_empty_when_no_resources() {
        given()
                .queryParam("q", "nonexistent-xyz")
                .when().get("/calm/search")
                .then()
                .statusCode(200)
                .body("architectures", hasSize(0))
                .body("patterns", hasSize(0));
    }

    @Test
    @Order(2)
    void end_to_end_create_architecture_for_search() {
        given()
                .body("""
                        {
                            "name": "Search Test Architecture",
                            "description": "Architecture for search testing",
                            "architectureJson": "{\\"nodes\\": []}"
                        }
                        """)
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/architectures")
                .then()
                .statusCode(201);
    }

    @Test
    @Order(3)
    void end_to_end_search_finds_architecture_by_name() {
        given()
                .queryParam("q", "Search Test")
                .when().get("/calm/search")
                .then()
                .statusCode(200)
                .body("architectures", hasSize(1))
                .body("architectures[0].name", equalTo("Search Test Architecture"))
                .body("architectures[0].namespace", equalTo("finos"));
    }

    @Test
    @Order(4)
    void end_to_end_search_finds_architecture_by_description() {
        given()
                .queryParam("q", "search testing")
                .when().get("/calm/search")
                .then()
                .statusCode(200)
                .body("architectures", hasSize(1))
                .body("architectures[0].name", equalTo("Search Test Architecture"));
    }

    @Test
    @Order(5)
    void end_to_end_search_is_case_insensitive() {
        given()
                .queryParam("q", "SEARCH TEST")
                .when().get("/calm/search")
                .then()
                .statusCode(200)
                .body("architectures", hasSize(1));
    }

    @Test
    @Order(6)
    void end_to_end_create_pattern_for_search() {
        given()
                .body("""
                        {
                            "name": "Search Test Pattern",
                            "description": "Pattern for search testing",
                            "patternJson": "{\\"nodes\\": []}"
                        }
                        """)
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/patterns")
                .then()
                .statusCode(201);
    }

    @Test
    @Order(7)
    void end_to_end_search_finds_pattern_by_name() {
        given()
                .queryParam("q", "Search Test Pattern")
                .when().get("/calm/search")
                .then()
                .statusCode(200)
                .body("patterns", hasSize(1))
                .body("patterns[0].name", equalTo("Search Test Pattern"))
                .body("patterns[0].namespace", equalTo("finos"));
    }

    @Test
    @Order(8)
    void end_to_end_create_control_for_search() {
        given()
                .body("""
                        {
                            "name": "Search Test Control",
                            "description": "Control for search testing",
                            "requirementJson": "{\\"type\\": \\"requirement\\"}"
                        }
                        """)
                .header("Content-Type", "application/json")
                .when().post("/calm/domains/security/controls")
                .then()
                .statusCode(201);
    }

    @Test
    @Order(9)
    void end_to_end_search_finds_control_by_name() {
        given()
                .queryParam("q", "Search Test Control")
                .when().get("/calm/search")
                .then()
                .statusCode(200)
                .body("controls", hasSize(1))
                .body("controls[0].name", equalTo("Search Test Control"))
                .body("controls[0].namespace", equalTo("security"));
    }

    @Test
    @Order(10)
    void end_to_end_search_across_multiple_resource_types() {
        given()
                .queryParam("q", "Search Test")
                .when().get("/calm/search")
                .then()
                .statusCode(200)
                .body("architectures", hasSize(1))
                .body("patterns", hasSize(1))
                .body("controls", hasSize(1));
    }
}
