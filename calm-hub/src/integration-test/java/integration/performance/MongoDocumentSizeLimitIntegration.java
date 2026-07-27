package integration.performance;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoDatabase;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.restassured.http.ContentType;
import io.restassured.response.Response;
import integration.IntegrationTestProfile;
import org.eclipse.microprofile.config.ConfigProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static integration.MongoSetup.counterSetup;
import static integration.MongoSetup.domainSetup;
import static integration.MongoSetup.namespaceSetup;
import static integration.performance.ConcurrencyTestHelper.extractIdsFromLocations;
import static io.restassured.RestAssured.given;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Regression test for issue #2884: a MongoDB write that fails because the namespace's
 * one-document-per-namespace shape has exceeded the 16MB BSON document limit must surface as
 * an honest {@code 413} (via {@link org.finos.calm.domain.exception.StorageWriteException}),
 * not the misleading {@code 404} the store used to throw for any {@code MongoWriteException}.
 *
 * <p>Grows a single architecture's version history against a real MongoDB instance until a
 * write is rejected for exceeding the document size limit, then asserts the response is 413.
 */
@QuarkusTest
@TestProfile(IntegrationTestProfile.class)
public class MongoDocumentSizeLimitIntegration {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    // Comfortably above the ~12-15 versions expected to be needed to cross the 16MB ceiling
    // with ~2MB versions, without letting a stuck test run indefinitely.
    private static final int MAX_VERSION_ATTEMPTS = 20;

    @BeforeEach
    public void setup() {
        String mongoUri = ConfigProvider.getConfig().getValue("quarkus.mongodb.connection-string", String.class);
        String mongoDatabase = ConfigProvider.getConfig().getValue("quarkus.mongodb.database", String.class);

        try (MongoClient mongoClient = MongoClients.create(mongoUri)) {
            MongoDatabase database = mongoClient.getDatabase(mongoDatabase);
            namespaceSetup(database);
            domainSetup(database);
            counterSetup(database);
        }
    }

    @Test
    void return_413_when_a_version_write_exceeds_the_document_size_limit() throws Exception {
        Response createResponse = given()
                .contentType(ContentType.JSON)
                .body(OBJECT_MAPPER.writeValueAsString(Map.of(
                        "name", "size-limit-test-architecture",
                        "description", "for document size limit test",
                        "architectureJson", "{\"v\":\"1.0.0\"}"
                )))
                .when().post("/api/calm/namespaces/finos/architectures")
                .thenReturn();
        assertEquals(201, createResponse.getStatusCode());

        List<Integer> architectureIds = extractIdsFromLocations(List.of(createResponse), "architectures/(\\d+)");
        int architectureId = architectureIds.get(0);

        // Roughly 2MB of content per version; large enough to cross the 16MB document ceiling
        // in a handful of writes without either request individually tripping an unrelated
        // HTTP body-size limit.
        String largeArchitectureJson = OBJECT_MAPPER.writeValueAsString(Map.of("data", "A".repeat(2_000_000)));

        // The request body is identical on every iteration (only the path's version differs),
        // so serialize it once rather than re-serializing the ~2MB payload each time.
        String requestBody = OBJECT_MAPPER.writeValueAsString(Map.of(
                "name", "size-limit-test-architecture",
                "description", "for document size limit test",
                "architectureJson", largeArchitectureJson
        ));

        Response lastResponse = null;
        int version = 2;
        for (; version < MAX_VERSION_ATTEMPTS; version++) {
            lastResponse = given()
                    .contentType(ContentType.JSON)
                    .body(requestBody)
                    .when().put("/api/calm/namespaces/finos/architectures/" + architectureId + "/versions/" + version + ".0.0")
                    .thenReturn();

            if (lastResponse.getStatusCode() != 201) {
                break;
            }
        }

        assertTrue(version < MAX_VERSION_ATTEMPTS,
                "Expected a write to fail with document-too-large before " + MAX_VERSION_ATTEMPTS + " versions were written");
        assertEquals(413, lastResponse.getStatusCode(),
                "Expected 413 (capacity exceeded) once the document exceeds MongoDB's 16MB limit, got: "
                        + lastResponse.getStatusCode() + " body=" + lastResponse.getBody().asString());
    }
}
