package integration.performance;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.restassured.http.ContentType;
import io.restassured.response.Response;
import integration.NitriteIntegrationTestProfile;
import integration.NitriteSetup;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

import static integration.performance.ConcurrencyTestHelper.*;
import static io.restassured.RestAssured.given;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Concurrency integration tests for the Nitrite (standalone) backend.
 * Verifies that concurrent POST operations across all entity types do not cause
 * data loss, duplicate IDs, or data overwrites.
 */
@QuarkusTest
@TestProfile(NitriteIntegrationTestProfile.class)
public class NitriteConcurrencyIntegration {

    private static final Logger LOG = LoggerFactory.getLogger(NitriteConcurrencyIntegration.class);
    private static final int THREADS = DEFAULT_THREAD_COUNT;

    @BeforeEach
    public void setup() {
        NitriteSetup.namespaceSetup();
        NitriteSetup.domainSetup();
    }

    // ======================== PATTERNS ========================

    @Test
    void concurrent_pattern_creation_produces_unique_ids_and_no_data_loss() {
        int countBefore = given()
                .when().get("/api/calm/namespaces/finos/patterns")
                .then().statusCode(200)
                .extract().jsonPath().getList("values").size();

        ConcurrencyResult<Response> result = runConcurrently(THREADS, () ->
                given()
                        .contentType(ContentType.JSON)
                        .body("""
                                {
                                    "name": "concurrent-pattern",
                                    "description": "concurrency test",
                                    "patternJson": "{\\"test\\": true}"
                                }
                                """)
                        .when().post("/api/calm/namespaces/finos/patterns")
                        .thenReturn()
        );

        assertTrue(result.allSucceeded(), "Some pattern creation requests failed: " + result.errors());
        assertAllStatusCodes(result.successfulResults(), 201);

        List<Integer> ids = extractIdsFromLocations(result.successfulResults(), "patterns/(\\d+)");
        assertEquals(THREADS, ids.size(), "Not all responses had Location headers with IDs");
        assertAllIdsUnique(ids);

        // Verify all patterns are persisted
        int countAfter = given()
                .when().get("/api/calm/namespaces/finos/patterns")
                .then().statusCode(200)
                .extract().jsonPath().getList("values").size();

        assertNoDataLoss(THREADS, countAfter - countBefore, "Pattern");
    }

    // ======================== ARCHITECTURES ========================

    @Test
    void concurrent_architecture_creation_produces_unique_ids_and_no_data_loss() {
        int countBefore = given()
                .when().get("/api/calm/namespaces/finos/architectures")
                .then().statusCode(200)
                .extract().jsonPath().getList("values").size();

        ConcurrencyResult<Response> result = runConcurrently(THREADS, () ->
                given()
                        .contentType(ContentType.JSON)
                        .body("""
                                {
                                    "name": "concurrent-arch",
                                    "description": "concurrency test",
                                    "architectureJson": "{\\"test\\": true}"
                                }
                                """)
                        .when().post("/api/calm/namespaces/finos/architectures")
                        .thenReturn()
        );

        assertTrue(result.allSucceeded(), "Some architecture creation requests failed: " + result.errors());
        assertAllStatusCodes(result.successfulResults(), 201);

        List<Integer> ids = extractIdsFromLocations(result.successfulResults(), "architectures/(\\d+)");
        assertEquals(THREADS, ids.size());
        assertAllIdsUnique(ids);

        int countAfter = given()
                .when().get("/api/calm/namespaces/finos/architectures")
                .then().statusCode(200)
                .extract().jsonPath().getList("values").size();

        assertNoDataLoss(THREADS, countAfter - countBefore, "Architecture");
    }

    // ======================== FLOWS ========================

    @Test
    void concurrent_flow_creation_produces_unique_ids_and_no_data_loss() {
        int countBefore = given()
                .when().get("/api/calm/namespaces/finos/flows")
                .then().statusCode(200)
                .extract().jsonPath().getList("values").size();

        ConcurrencyResult<Response> result = runConcurrently(THREADS, () ->
                given()
                        .contentType(ContentType.JSON)
                        .body("""
                                {
                                    "name": "concurrent-flow",
                                    "description": "concurrency test",
                                    "flowJson": "{\\"test\\": true}"
                                }
                                """)
                        .when().post("/api/calm/namespaces/finos/flows")
                        .thenReturn()
        );

        assertTrue(result.allSucceeded(), "Some flow creation requests failed: " + result.errors());
        assertAllStatusCodes(result.successfulResults(), 201);

        List<Integer> ids = extractIdsFromLocations(result.successfulResults(), "flows/(\\d+)");
        assertEquals(THREADS, ids.size());
        assertAllIdsUnique(ids);

        int countAfter = given()
                .when().get("/api/calm/namespaces/finos/flows")
                .then().statusCode(200)
                .extract().jsonPath().getList("values").size();

        assertNoDataLoss(THREADS, countAfter - countBefore, "Flow");
    }

    // ======================== STANDARDS ========================

    @Test
    void concurrent_standard_creation_produces_unique_ids_and_no_data_loss() {
        int countBefore = given()
                .when().get("/api/calm/namespaces/finos/standards")
                .then().statusCode(200)
                .extract().jsonPath().getList("values").size();

        ConcurrencyResult<Response> result = runConcurrently(THREADS, () ->
                given()
                        .contentType(ContentType.JSON)
                        .body("""
                                {
                                    "name": "concurrent-standard",
                                    "description": "concurrency test",
                                    "standardJson": "{}"
                                }
                                """)
                        .when().post("/api/calm/namespaces/finos/standards")
                        .thenReturn()
        );

        assertTrue(result.allSucceeded(), "Some standard creation requests failed: " + result.errors());
        assertAllStatusCodes(result.successfulResults(), 201);

        List<Integer> ids = extractIdsFromLocations(result.successfulResults(), "standards/(\\d+)");
        assertEquals(THREADS, ids.size());
        assertAllIdsUnique(ids);

        int countAfter = given()
                .when().get("/api/calm/namespaces/finos/standards")
                .then().statusCode(200)
                .extract().jsonPath().getList("values").size();

        assertNoDataLoss(THREADS, countAfter - countBefore, "Standard");
    }

    // ======================== INTERFACES ========================

    @Test
    void concurrent_interface_creation_produces_unique_ids_and_no_data_loss() {
        int countBefore = given()
                .when().get("/api/calm/namespaces/finos/interfaces")
                .then().statusCode(200)
                .extract().jsonPath().getList("values").size();

        ConcurrencyResult<Response> result = runConcurrently(THREADS, () ->
                given()
                        .contentType(ContentType.JSON)
                        .body("""
                                {
                                    "name": "concurrent-interface",
                                    "description": "concurrency test",
                                    "interfaceJson": "{}"
                                }
                                """)
                        .when().post("/api/calm/namespaces/finos/interfaces")
                        .thenReturn()
        );

        assertTrue(result.allSucceeded(), "Some interface creation requests failed: " + result.errors());
        assertAllStatusCodes(result.successfulResults(), 201);

        List<Integer> ids = extractIdsFromLocations(result.successfulResults(), "interfaces/(\\d+)");
        assertEquals(THREADS, ids.size());
        assertAllIdsUnique(ids);

        int countAfter = given()
                .when().get("/api/calm/namespaces/finos/interfaces")
                .then().statusCode(200)
                .extract().jsonPath().getList("values").size();

        assertNoDataLoss(THREADS, countAfter - countBefore, "Interface");
    }

    // ======================== DECORATORS ========================

    @Test
    void concurrent_decorator_creation_produces_unique_ids_and_no_data_loss() {
        int countBefore = given()
                .when().get("/api/calm/namespaces/finos/decorators")
                .then().statusCode(200)
                .extract().jsonPath().getList("values").size();

        ConcurrencyResult<Response> result = runConcurrently(THREADS, () ->
                given()
                        .contentType(ContentType.JSON)
                        .body("""
                                {
                                    "unique-id": "concurrent-decorator",
                                    "type": "deployment",
                                    "target": ["/api/calm/namespaces/finos/architectures/1/versions/1-0-0"],
                                    "target-type": ["architecture"],
                                    "applies-to": ["example-node"],
                                    "data": {"status": "test"}
                                }
                                """)
                        .when().post("/api/calm/namespaces/finos/decorators")
                        .thenReturn()
        );

        assertTrue(result.allSucceeded(), "Some decorator creation requests failed: " + result.errors());
        assertAllStatusCodes(result.successfulResults(), 201);

        List<Integer> ids = extractIdsFromLocations(result.successfulResults(), "decorators/(\\d+)");
        assertEquals(THREADS, ids.size());
        assertAllIdsUnique(ids);

        int countAfter = given()
                .when().get("/api/calm/namespaces/finos/decorators")
                .then().statusCode(200)
                .extract().jsonPath().getList("values").size();

        assertNoDataLoss(THREADS, countAfter - countBefore, "Decorator");
    }

    // ======================== CONTROLS ========================

    @Test
    void concurrent_control_creation_produces_unique_ids_and_no_data_loss() {
        int countBefore = given()
                .when().get("/calm/domains/security/controls")
                .then().statusCode(200)
                .extract().jsonPath().getList("values").size();

        // Each thread creates a distinctly-named control via the name-based requirement endpoint.
        ConcurrencyResult<Response> result = runConcurrently(THREADS, new java.util.concurrent.atomic.AtomicInteger(0), (index) ->
                given()
                        .contentType(ContentType.JSON)
                        .body("{\"$id\":\"http://localhost:8080/calm/domains/security/controls/concurrent-control-" + index
                                + "/requirement/versions/1.0.0\",\"type\":\"requirement\",\"description\":\"concurrency test\"}")
                        .when().post("/calm/domains/security/controls/concurrent-control-" + index + "/requirement/versions/1.0.0")
                        .thenReturn()
        );

        assertTrue(result.allSucceeded(), "Some control creation requests failed: " + result.errors());
        assertAllStatusCodes(result.successfulResults(), 201);

        // Controls are now identified by name; verify every concurrently-created control persisted
        // (no lost updates to the domain's controls array) and the count grew by exactly THREADS.
        List<String> names = given()
                .when().get("/calm/domains/security/controls")
                .then().statusCode(200)
                .extract().jsonPath().getList("values.name");
        for (int i = 0; i < THREADS; i++) {
            assertTrue(names.contains("concurrent-control-" + i), "Missing control concurrent-control-" + i);
        }
        assertNoDataLoss(THREADS, names.size() - countBefore, "Control");
    }

    @Test
    void concurrent_control_configuration_creation_produces_unique_ids_and_no_data_loss() {
        // Pre-create a named control via the requirement endpoint.
        given()
                .contentType(ContentType.JSON)
                .body("{\"$id\":\"http://localhost:8080/calm/domains/security/controls/config-test-control/requirement/versions/1.0.0\",\"type\":\"requirement\",\"description\":\"for config concurrency test\"}")
                .when().post("/calm/domains/security/controls/config-test-control/requirement/versions/1.0.0")
                .then().statusCode(201);

        // Each thread creates a distinctly-named configuration on that control.
        ConcurrencyResult<Response> result = runConcurrently(THREADS, new java.util.concurrent.atomic.AtomicInteger(0), (index) ->
                given()
                        .contentType(ContentType.JSON)
                        .body("{\"$id\":\"http://localhost:8080/calm/domains/security/controls/config-test-control/configurations/config-" + index
                                + "/versions/1.0.0\",\"setting\":\"enabled\"}")
                        .when().post("/calm/domains/security/controls/config-test-control/configurations/config-" + index + "/versions/1.0.0")
                        .thenReturn()
        );

        assertTrue(result.allSucceeded(), "Some config creation requests failed: " + result.errors());
        assertAllStatusCodes(result.successfulResults(), 201);

        int countAfter = given()
                .when().get("/calm/domains/security/controls/config-test-control/configurations")
                .then().statusCode(200)
                .extract().jsonPath().getList("values").size();

        assertNoDataLoss(THREADS, countAfter, "ControlConfiguration");
    }

    // ======================== CONCURRENT VERSION CREATION ========================

    @Test
    void concurrent_pattern_version_creation_no_data_loss() {
        // Pre-create a pattern
        Response createResponse = given()
                .contentType(ContentType.JSON)
                .body("""
                        {
                            "name": "version-test-pattern",
                            "description": "for version concurrency test",
                            "patternJson": "{\\"v\\": \\"1.0.0\\"}"
                        }
                        """)
                .when().post("/api/calm/namespaces/finos/patterns")
                .thenReturn();
        assertEquals(201, createResponse.getStatusCode());

        List<Integer> patternIds = extractIdsFromLocations(List.of(createResponse), "patterns/(\\d+)");
        int patternId = patternIds.get(0);

        // Each thread creates a unique version
        ConcurrencyResult<Response> result = runConcurrently(THREADS, new java.util.concurrent.atomic.AtomicInteger(0), (index) ->
                given()
                        .contentType(ContentType.JSON)
                        .body("{\"name\":\"version-test-pattern\",\"description\":\"for version concurrency test\",\"patternJson\":\"{\\\"v\\\": \\\"" + (index + 2) + ".0.0\\\"}\"}")
                        .when().post("/api/calm/namespaces/finos/patterns/" + patternId + "/versions/" + (index + 2) + ".0.0")
                        .thenReturn()
        );

        assertTrue(result.allSucceeded(), "Some version creation requests failed: " + result.errors());
        assertAllStatusCodes(result.successfulResults(), 201);

        // Verify all versions were created (1.0.0 initial + THREADS new versions)
        int versionCount = given()
                .when().get("/api/calm/namespaces/finos/patterns/" + patternId + "/versions")
                .then().statusCode(200)
                .extract().jsonPath().getList("values").size();

        assertNoDataLoss(THREADS + 1, versionCount, "PatternVersion");
    }

    @Test
    void concurrent_control_requirement_version_creation_no_data_loss() {
        // Pre-create a named control at version 1.0.0 via the requirement endpoint.
        given()
                .contentType(ContentType.JSON)
                .body("{\"$id\":\"http://localhost:8080/calm/domains/security/controls/version-test-control/requirement/versions/1.0.0\",\"type\":\"requirement\",\"description\":\"for version concurrency test\"}")
                .when().post("/calm/domains/security/controls/version-test-control/requirement/versions/1.0.0")
                .then().statusCode(201);

        // Each thread adds a distinct requirement version to that control.
        ConcurrencyResult<Response> result = runConcurrently(THREADS, new java.util.concurrent.atomic.AtomicInteger(0), (index) ->
                given()
                        .contentType(ContentType.JSON)
                        .body("{\"$id\":\"http://localhost:8080/calm/domains/security/controls/version-test-control/requirement/versions/" + (index + 2)
                                + ".0.0\",\"type\":\"requirement-v" + (index + 2) + "\"}")
                        .when().post("/calm/domains/security/controls/version-test-control/requirement/versions/" + (index + 2) + ".0.0")
                        .thenReturn()
        );

        assertTrue(result.allSucceeded(), "Some requirement version creation requests failed: " + result.errors());
        assertAllStatusCodes(result.successfulResults(), 201);

        int versionCount = given()
                .when().get("/calm/domains/security/controls/version-test-control/requirement/versions")
                .then().statusCode(200)
                .extract().jsonPath().getList("values").size();

        assertNoDataLoss(THREADS + 1, versionCount, "ControlRequirementVersion");
    }
}
