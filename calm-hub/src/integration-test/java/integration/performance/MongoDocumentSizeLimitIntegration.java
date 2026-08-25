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
import org.bson.Document;
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

/**
 * What issue #2884 set out to remove: MongoDB's 16MB per-document ceiling, reachable because
 * every version's full content accumulated in one document per namespace.
 *
 * <p>Asserted against a real MongoDB with ~2MB versions — roughly 24MB of history written to
 * a single architecture without any write failing. Under the old shape that was impossible
 * by construction; each version is now its own document, bounded by its own size.</p>
 *
 * <h2>The 413 half of this test has retired</h2>
 * It asserted the opposite property — that a type still accumulating history into one
 * document eventually fails, and that the failure surfaces as an honest {@code 413} via
 * {@link org.finos.calm.domain.exception.StorageWriteException} rather than the misleading
 * {@code 404} the stores once threw for any {@code MongoWriteException}. It moved to a
 * still-unmigrated type on each round — Architecture, Pattern, Flow, Standard, Timeline —
 * and ran out of homes: every namespace-scoped versioned type now uses the header/version
 * shape, so nothing reachable through these endpoints can hit the ceiling any more.
 *
 * <p>Control is the one resource that keeps the old shape permanently (ADR 0004), but it is
 * domain-scoped with a different path and envelope, so hosting the assertion there would
 * have meant rewriting it to test a resource this redesign deliberately excludes. Retired
 * instead. {@code MongoWriteFailures} still classifies {@code BSONObjectTooLarge}, and its
 * unit tests still cover that mapping — what is gone is the end-to-end route to provoking
 * it.</p>
 */
@QuarkusTest
@TestProfile(IntegrationTestProfile.class)
public class MongoDocumentSizeLimitIntegration {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();


    /**
     * Enough ~2MB versions to total roughly 24MB — well past the 16MB ceiling the old shape
     * hits, so writing them all is only possible because history is no longer accumulated
     * into one document.
     */
    private static final int VERSIONS_BEYOND_OLD_CEILING = 12;

    /** Roughly 2MB, large enough to cross the ceiling in a handful of writes. */
    private static final String LARGE_CONTENT = "A".repeat(2_000_000);

    /**
     * Runs against its own namespace rather than {@code finos}, because it cannot clean up
     * after itself: it leaves roughly 24MB of version documents behind, which would otherwise
     * turn up in any later listing of {@code finos} architectures.
     *
     * <p>This mattered more while the 413 half still existed — that one wedged the shared
     * {@code flows} document past the ceiling and left it there, so every later flow write in
     * the namespace failed with 413 rather than 201, masked only by the order failsafe
     * happened to run these classes in. Isolation is cheap enough to keep now that the
     * surviving test's leftovers are merely noisy rather than destructive.</p>
     */
    private static final String NAMESPACE = "size-limit";

    @BeforeEach
    public void setup() {
        String mongoUri = ConfigProvider.getConfig().getValue("quarkus.mongodb.connection-string", String.class);
        String mongoDatabase = ConfigProvider.getConfig().getValue("quarkus.mongodb.database", String.class);

        try (MongoClient mongoClient = MongoClients.create(mongoUri)) {
            MongoDatabase database = mongoClient.getDatabase(mongoDatabase);
            namespaceSetup(database);
            domainSetup(database);
            counterSetup(database);

            // namespaceSetup only seeds when the collection is empty, so the dedicated
            // namespace has to be inserted on its own terms.
            if (database.getCollection("namespaces").countDocuments(new Document("name", NAMESPACE)) == 0) {
                database.getCollection("namespaces").insertOne(
                        new Document("name", NAMESPACE).append("description", "document size limit test namespace"));
            }
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
                .when().post("/api/calm/namespaces/" + NAMESPACE + "/" + path)
                .thenReturn();
        assertEquals(201, response.getStatusCode());
        return extractIdsFromLocations(List.of(response), path + "/(\\d+)").get(0);
    }

    private static Response putVersion(String path, int id, int major, String body) {
        return given()
                .contentType(ContentType.JSON)
                .body(body)
                .when().put("/api/calm/namespaces/" + NAMESPACE + "/" + path + "/" + id + "/versions/" + major + ".0.0")
                .thenReturn();
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
                given().when().get("/api/calm/namespaces/" + NAMESPACE + "/architectures/" + architectureId + "/versions")
                        .then().statusCode(200).extract().jsonPath().getList("values").size());
    }
}
