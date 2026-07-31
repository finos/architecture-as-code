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
 * The two halves of issue #2884's document-size story, one per storage shape.
 *
 * <p><b>Pattern</b> still uses the one-document-per-namespace shape, where every version's
 * full content accumulates in a single document. Growing its history eventually crosses
 * MongoDB's 16MB BSON ceiling, and that failure must surface as an honest {@code 413} via
 * {@link org.finos.calm.domain.exception.StorageWriteException} — not the misleading
 * {@code 404} the stores used to throw for any {@code MongoWriteException}. This is the
 * original regression test, repointed from Architecture when Architecture migrated.</p>
 *
 * <p><b>Architecture</b> has moved to the header/version shape, where each version is its
 * own document bounded by its own size. The same history that breaks Pattern must now be
 * writable, which is the whole point of the redesign. Keeping both in one class means the
 * ceiling and its removal are asserted against the same real MongoDB, with the same payload
 * size, rather than being argued about.</p>
 */
@QuarkusTest
@TestProfile(IntegrationTestProfile.class)
public class MongoDocumentSizeLimitIntegration {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    // Comfortably above the ~12-15 versions expected to be needed to cross the 16MB ceiling
    // with ~2MB versions, without letting a stuck test run indefinitely.
    private static final int MAX_VERSION_ATTEMPTS = 20;

    /**
     * Enough ~2MB versions to total roughly 24MB — well past the 16MB ceiling the old shape
     * hits, so writing them all is only possible because history is no longer accumulated
     * into one document.
     */
    private static final int VERSIONS_BEYOND_OLD_CEILING = 12;

    /** Roughly 2MB, large enough to cross the ceiling in a handful of writes. */
    private static final String LARGE_CONTENT = "A".repeat(2_000_000);

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

    private static String largeBody(String jsonField, String name) throws Exception {
        return OBJECT_MAPPER.writeValueAsString(Map.of(
                "name", name,
                "description", "for document size limit test",
                jsonField, OBJECT_MAPPER.writeValueAsString(Map.of("data", LARGE_CONTENT))));
    }

    private static int createResource(String path, String jsonField, String name) throws Exception {
        Response response = given()
                .contentType(ContentType.JSON)
                .body(OBJECT_MAPPER.writeValueAsString(Map.of(
                        "name", name,
                        "description", "for document size limit test",
                        jsonField, "{\"v\":\"1.0.0\"}")))
                .when().post("/api/calm/namespaces/finos/" + path)
                .thenReturn();
        assertEquals(201, response.getStatusCode());
        return extractIdsFromLocations(List.of(response), path + "/(\\d+)").get(0);
    }

    private static Response putVersion(String path, int id, int major, String body) {
        return given()
                .contentType(ContentType.JSON)
                .body(body)
                .when().put("/api/calm/namespaces/finos/" + path + "/" + id + "/versions/" + major + ".0.0")
                .thenReturn();
    }

    @Test
    void return_413_when_a_version_write_exceeds_the_document_size_limit() throws Exception {
        int patternId = createResource("patterns", "patternJson", "size-limit-test-pattern");
        String requestBody = largeBody("patternJson", "size-limit-test-pattern");

        Response lastResponse = null;
        int version = 2;
        for (; version < MAX_VERSION_ATTEMPTS; version++) {
            lastResponse = putVersion("patterns", patternId, version, requestBody);
            if (lastResponse.getStatusCode() != 201) {
                break;
            }
        }

        assertTrue(version < MAX_VERSION_ATTEMPTS,
                "Expected a write to fail with document-too-large before " + MAX_VERSION_ATTEMPTS
                        + " versions were written. Patterns still accumulate every version's content into "
                        + "one document per namespace, so this ceiling should still exist for them.");
        assertEquals(413, lastResponse.getStatusCode(),
                "Expected 413 (capacity exceeded) once the document exceeds MongoDB's 16MB limit, got: "
                        + lastResponse.getStatusCode() + " body=" + lastResponse.getBody().asString());
    }

    @Test
    void keep_accepting_architecture_versions_well_past_the_old_document_ceiling() throws Exception {
        int architectureId = createResource("architectures", "architectureJson", "size-limit-test-architecture");
        String requestBody = largeBody("architectureJson", "size-limit-test-architecture");

        for (int version = 2; version < VERSIONS_BEYOND_OLD_CEILING + 2; version++) {
            Response response = putVersion("architectures", architectureId, version, requestBody);
            assertEquals(201, response.getStatusCode(),
                    "Version " + version + ".0.0 was rejected with " + response.getStatusCode()
                            + ". Under the header/version shape each version is its own document, so total "
                            + "history size should no longer be able to fail a write. body="
                            + response.getBody().asString());
        }

        // Roughly 24MB of history, against a 16MB per-document limit — proof the accumulated
        // total is no longer what any single write is measured against.
        assertEquals(VERSIONS_BEYOND_OLD_CEILING + 1,
                given().when().get("/api/calm/namespaces/finos/architectures/" + architectureId + "/versions")
                        .then().statusCode(200).extract().jsonPath().getList("values").size());
    }
}
