package integration;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoDatabase;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import org.bson.Document;
import org.eclipse.microprofile.config.ConfigProvider;
import org.finos.calm.domain.InterfaceRequest;
import org.junit.jupiter.api.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;

import static integration.MongoSetup.counterSetup;
import static integration.MongoSetup.namespaceSetup;
import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
@TestProfile(IntegrationTestProfile.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class MongoInterfaceIntegration {

    private static final Logger logger = LoggerFactory.getLogger(MongoInterfaceIntegration.class);
    private static final InterfaceRequest INTERFACE_REQUEST = new InterfaceRequest("interface name", "interface description", "{\"name\": \"interface-json\"}");

    @BeforeEach
    public void setupInterfaces() {
        String mongoUri = ConfigProvider.getConfig().getValue("quarkus.mongodb.connection-string", String.class);

        // Safeguard: Fail fast if URI is not set
        if (mongoUri == null || mongoUri.isBlank()) {
            logger.error("MongoDB URI is not set. Check the EndToEndResource configuration.");
            throw new IllegalStateException("MongoDB URI is not set. Check the EndToEndResource configuration.");
        }

        try (MongoClient mongoClient = MongoClients.create(mongoUri)) {
            MongoDatabase database = mongoClient.getDatabase("calmSchemas");

            if (!database.listCollectionNames().into(new ArrayList<>()).contains("interfaces")) {
                database.createCollection("interfaces");
                database.getCollection("interfaces").insertOne(
                        new Document("namespace", "finos").append("interfaces", new ArrayList<>())
                );
            }

            counterSetup(database);
            namespaceSetup(database);
        }
    }

//    @Test
//    @Order(1)
//    void end_to_end_get_with_no_flow() {
//        given()
//                .when().get("/calm/namespaces/finos/flows")
//                .then()
//                .statusCode(200)
//                .body("values", empty());
//    }

    @Test
    @Order(1)
    void end_to_end_create_an_interface() {
        given()
                .body(INTERFACE_REQUEST)
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/interfaces")
                .then()
                .statusCode(201)
                .header("Location", containsString("calm/namespaces/finos/interfaces/1/versions/1.0.0"));
    }
}
