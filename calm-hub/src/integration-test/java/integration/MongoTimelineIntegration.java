package integration;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoDatabase;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import org.bson.Document;
import org.eclipse.microprofile.config.ConfigProvider;
import org.junit.jupiter.api.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static io.restassured.RestAssured.given;
import static integration.MongoSetup.counterSetup;
import static integration.MongoSetup.namespaceSetup;
import static org.hamcrest.Matchers.*;

@QuarkusTest
@TestProfile(IntegrationTestProfile.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class MongoTimelineIntegration {

    private static final Logger logger = LoggerFactory.getLogger(MongoTimelineIntegration.class);
    public static final String TIMELINE = "{\"moments\": []}";
    public static final String TIMELINE_V2 = "{\"moments\": [{\"unique-id\": \"1.0.0\"}]}";

    private static final Pattern TIMELINE_ID_PATTERN = Pattern.compile("/timelines/(\\d+)");

    private static int createdTimelineId;

    @BeforeEach
    public void setupTimelines() {
        String mongoUri = ConfigProvider.getConfig().getValue("quarkus.mongodb.connection-string", String.class);
        String mongoDatabase = ConfigProvider.getConfig().getValue("quarkus.mongodb.database", String.class);

        // Safeguard: Fail fast if URI is not set
        if (mongoUri == null || mongoUri.isBlank()) {
            logger.error("MongoDB URI is not set. Check the EndToEndResource configuration.");
            throw new IllegalStateException("MongoDB URI is not set. Check the EndToEndResource configuration.");
        }

        try (MongoClient mongoClient = MongoClients.create(mongoUri)) {
            MongoDatabase database = mongoClient.getDatabase(mongoDatabase);

            if (!database.listCollectionNames().into(new ArrayList<>()).contains("timelines")) {
                database.createCollection("timelines");
                database.getCollection("timelines").insertOne(
                        new Document("namespace", "finos").append("timelines", new ArrayList<>())
                );
            }

            counterSetup(database);
            namespaceSetup(database);
        }
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

        Matcher matcher = TIMELINE_ID_PATTERN.matcher(location);
        if (!matcher.find()) {
            throw new IllegalStateException("Could not extract timeline ID from Location header: " + location);
        }
        createdTimelineId = Integer.parseInt(matcher.group(1));
        logger.info("Created timeline with ID: {}", createdTimelineId);
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
