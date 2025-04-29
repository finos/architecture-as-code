package integration;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoDatabase;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import org.eclipse.microprofile.config.ConfigProvider;
import org.finos.calm.domain.Domain;
import org.junit.jupiter.api.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;

@QuarkusTest
@TestProfile(IntegrationTestProfile.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class MongoDomainIntegration {

    private static final Logger logger = LoggerFactory.getLogger(MongoAdrIntegration.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    public void setupDomains() {
        String mongoUri = ConfigProvider.getConfig().getValue("quarkus.mongodb.connection-string", String.class);

        if (mongoUri == null || mongoUri.isBlank()) {
            logger.error("MongoDB URI is not set. Check the EndToEndResource configuration.");
            throw new IllegalStateException("MongoDB URI is not set. Check the EndToEndResource configuration.");
        }

        try (MongoClient mongoClient = MongoClients.create(mongoUri)) {
            MongoDatabase database = mongoClient.getDatabase("calmSchemas");
            MongoSetup.domainSetup(database);
        }
    }

    @Test
    @Order(1)
    void end_to_end_get_on_existing_domain() {
        given()
                .when().get("/calm/domains")
                .then()
                .statusCode(200)
                .body("values", hasItem("security"));
    }

    @Test
    @Order(2)
    void create_domain_that_doesnt_exist() throws JsonProcessingException {
        Domain domain = new Domain();
        domain.setName("finos");
        given()
                .body(objectMapper.writeValueAsString(domain))
                .header("Content-Type", "application/json")
                .when().post("/calm/domains")
                .then()
                .statusCode(201)
                .header("Location", containsString("calm/domains/finos"));
    }

    @Test
    @Order(3)
    void fails_when_creating_a_domain_the_second_time() throws JsonProcessingException {
        Domain domain = new Domain();
        domain.setName("finos");
        given()
                .body(objectMapper.writeValueAsString(domain))
                .header("Content-Type", "application/json")
                .when().post("/calm/domains")
                .then()
                .statusCode(409);
    }
}
