package integration;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoDatabase;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import org.bson.Document;
import org.eclipse.microprofile.config.ConfigProvider;
import org.finos.calm.domain.adr.Adr;
import org.finos.calm.domain.adr.AdrMeta;
import org.finos.calm.domain.adr.Decision;
import org.finos.calm.domain.adr.Link;
import org.finos.calm.domain.adr.NewAdrRequest;
import org.finos.calm.domain.adr.Option;
import org.finos.calm.domain.adr.Status;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.databind.ObjectMapper;
import static integration.MongoSetup.counterSetup;
import static integration.MongoSetup.namespaceSetup;
import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.assertEquals;

@QuarkusTest
@TestProfile(IntegrationTestProfile.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class MongoAdrIntegration {

    private ObjectMapper objectMapper;

    private static final Logger logger = LoggerFactory.getLogger(MongoAdrIntegration.class);

    private final String TITLE = "<b>My ADR</b><script><img>";
    private final String EXPECTED_TITLE = "<b>My ADR</b>";
    private final String PROBLEM_STATEMENT = "<a>My problem is...</a>";
    private final String EXPECTED_PROBLEM_STATEMENT = "My problem is...";
    private final List<String> DECISION_DRIVERS = List.of("a", "b", "c");
    private final Option OPTION_A = new Option("Option A", "optionDescription", List.of("a"), List.of("b"));
    private final Option OPTION_B = new Option("Option B", "optionDescription", List.of("c"), List.of("d"));
    private final List<Option> CONSIDERED_OPTIONS = List.of(OPTION_A, OPTION_B);
    private final String RATIONALE = "This is the best option";
    private final Decision DECISION_OUTCOME = new Decision(OPTION_A, RATIONALE);
    private final List<Link> LINKS = List.of(new Link("abc", "http://abc.com"));

    private final NewAdrRequest newAdr = new NewAdrRequest(TITLE, PROBLEM_STATEMENT, DECISION_DRIVERS,
            CONSIDERED_OPTIONS, DECISION_OUTCOME, LINKS);

    private final Adr adr = new Adr.AdrBuilder(newAdr).setTitle(EXPECTED_TITLE).setContextAndProblemStatement(EXPECTED_PROBLEM_STATEMENT).setStatus(Status.draft).build();

    @BeforeEach
    public void setupAdrs() {
        String mongoUri = ConfigProvider.getConfig().getValue("quarkus.mongodb.connection-string", String.class);

        // Safeguard: Fail fast if URI is not set
        if(mongoUri == null || mongoUri.isBlank()) {
            logger.error("MongoDB URI is not set. Check the EndToEndResource configuration.");
            throw new IllegalStateException("MongoDB URI is not set. Check the EndToEndResource configuration.");
        }

        try(MongoClient mongoClient = MongoClients.create(mongoUri)) {
            MongoDatabase database = mongoClient.getDatabase("calmSchemas");

            if(!database.listCollectionNames().into(new ArrayList<>()).contains("adrs")) {
                database.createCollection("adrs");
                database.getCollection("adrs").insertOne(
                        new Document("namespace", "finos").append("adrs", new ArrayList<>())
                );
            }

            counterSetup(database);
            namespaceSetup(database);
        }
        this.objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
    }

    @Test
    @Order(1)
    void end_to_end_verify_get_with_no_architecture() {
        given()
                .when().get("/calm/namespaces/finos/adrs")
                .then()
                .statusCode(200)
                .body("values", empty());
    }

    @Test
    @Order(2)
    void end_to_end_verify_create_an_adr() throws JsonProcessingException {
        given()
                .body(objectMapper.writeValueAsString(newAdr))
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/adrs")
                .then()
                .statusCode(201)
                .header("Location", containsString("calm/namespaces/finos/adrs/1"));
    }

    @Test
    @Order(3)
    void end_to_end_verify_get_adr_revision() {
        AdrMeta expectedAdrMeta = new AdrMeta.AdrMetaBuilder()
                .setNamespace("finos")
                .setId(1)
                .setRevision(1)
                .setAdr(adr)
                .build();

        AdrMeta actualAdrMeta = given()
                .when().get("/calm/namespaces/finos/adrs/1/revisions/1")
                .then()
                .statusCode(200)
                .extract()
                .body()
                .as(AdrMeta.class);
        assertEquals(expectedAdrMeta, actualAdrMeta);
    }

    @Test
    @Order(4)
    void end_to_end_verify_get_adr() {
        AdrMeta actualAdrMeta = given()
                .when().get("/calm/namespaces/finos/adrs/1")
                .then()
                .statusCode(200)
                .extract()
                .body()
                .as(AdrMeta.class);

        AdrMeta expectedAdrMeta = new AdrMeta.AdrMetaBuilder()
                .setNamespace("finos")
                .setId(1)
                .setRevision(1)
                .setAdr(adr)
                .build();
        assertEquals(expectedAdrMeta, actualAdrMeta);
    }

    @Test
    @Order(5)
    void end_to_end_verify_update_an_adr() throws JsonProcessingException {
        given()
                .body(objectMapper.writeValueAsString(newAdr))
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/adrs/1")
                .then()
                .statusCode(201)
                .header("Location", containsString("calm/namespaces/finos/adrs/1"));
    }

    @Test
    @Order(6)
    void end_to_end_verify_get_revisions() {
        given()
                .when().get("/calm/namespaces/finos/adrs/1/revisions")
                .then()
                .statusCode(200)
                .body("values", hasSize(2))
                .body("values[0]", equalTo(1))
                .body("values[1]", equalTo(2));

    }

    @Test
    @Order(7)
    void end_to_end_verify_update_an_adr_status() throws JsonProcessingException {
        given()
                .when().post("/calm/namespaces/finos/adrs/1/status/proposed")
                .then()
                .statusCode(201)
                .header("Location", containsString("calm/namespaces/finos/adrs/1"));
    }

    @Test
    @Order(8)
    void end_to_end_verify_status_changed() throws JsonProcessingException {

        given()
                .when().get("/calm/namespaces/finos/adrs/1/revisions/3")
                .then()
                .statusCode(200)
                .body("adr.status", equalTo("proposed"));
    }

}