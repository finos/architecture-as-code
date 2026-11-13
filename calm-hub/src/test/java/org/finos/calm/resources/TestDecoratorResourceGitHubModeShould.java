package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import org.finos.calm.store.DecoratorStore;
import org.finos.calm.store.github.GitHubDecoratorStore;
import org.finos.calm.store.github.registry.RegistrySnapshot;
import org.finos.calm.store.github.registry.ResourceRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.mockito.AdditionalAnswers.delegatesTo;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// The mock answers as the GitHub-mode store does, because a GitHub-mode Hub needs cloned repositories.
@TestSecurity(authorizationEnabled = false)
@QuarkusTest
@TestProfile(TestReservedDecoratorResourceShould.ReservedTypeProfile.class)
class TestDecoratorResourceGitHubModeShould {

    // The caller is not a writer of control-evaluation, which the profile reserves.
    private static final String RESERVED_DECORATOR_JSON = "{\"type\": \"control-evaluation\", \"data\": {}}";

    private static final String DECORATOR_THAT_DOES_NOT_MATCH_ITS_SCHEMA = """
            {
                "$schema": "https://calm.finos.org/standards/deployment/1.0/deployment.decorator.standard.json",
                "unique-id": "test-decorator-1",
                "type": "deployment",
                "target": ["/api/calm/namespaces/finos/architectures/1/versions/1-0-0"],
                "target-type": ["architecture"],
                "applies-to": ["web-service"],
                "data": {"start-time": "2026-02-23T10:00:00Z", "status": "done"}
            }
            """;

    @InjectMock
    DecoratorStore decoratorStore;

    @BeforeEach
    void answerAsTheGitHubStore() throws Exception {
        ResourceRegistry registry = mock(ResourceRegistry.class);
        when(registry.getSnapshot()).thenReturn(new RegistrySnapshot(Map.of("finos", List.of()), Map.of()));
        GitHubDecoratorStore gitHubStore = new GitHubDecoratorStore(registry);
        doAnswer(delegatesTo(gitHubStore)).when(decoratorStore).requireWritable();
        doAnswer(delegatesTo(gitHubStore)).when(decoratorStore).getDecoratorHistory(anyString(), anyInt());
        doAnswer(delegatesTo(gitHubStore)).when(decoratorStore).deleteCurrentDecoratorHistory(anyString(), anyInt());
    }

    @Test
    void return_501_for_a_delete() throws Exception {
        given()
                .when()
                .delete("/api/calm/namespaces/finos/decorators/1")
                .then()
                .statusCode(501)
                .body("error", containsString("Write operations are not yet available"));

        verify(decoratorStore, never()).getDecoratorHistory(anyString(), anyInt());
        verify(decoratorStore, never()).deleteCurrentDecoratorHistory(anyString(), anyInt());
    }

    @ParameterizedTest
    @ValueSource(strings = {"POST", "PUT"})
    void return_501_for_a_write_of_a_reserved_type(String method) throws Exception {
        assertWriteGives501(method, RESERVED_DECORATOR_JSON);
    }

    @ParameterizedTest
    @ValueSource(strings = {"POST", "PUT"})
    void return_501_for_a_write_that_does_not_match_its_schema(String method) throws Exception {
        assumeTrue(Files.exists(Path.of("target", "classes", "META-INF", "calm-schemas", "1.3", "meta", "decorators.json")),
                "run a full build (without -Pserver-only or -Dskip.npm) first");
        assertWriteGives501(method, DECORATOR_THAT_DOES_NOT_MATCH_ITS_SCHEMA);
    }

    private void assertWriteGives501(String method, String body) throws Exception {
        String path = "POST".equals(method) ? "/api/calm/namespaces/finos/decorators" : "/api/calm/namespaces/finos/decorators/1";
        given()
                .contentType(ContentType.JSON)
                .body(body)
                .when()
                .request(method, path)
                .then()
                .statusCode(501)
                .body("error", containsString("Write operations are not yet available"));

        verify(decoratorStore, never()).createDecorator(anyString(), anyString());
        verify(decoratorStore, never()).updateDecorator(anyString(), anyInt(), anyString());
        verify(decoratorStore, never()).supersedeDecorator(anyString(), anyInt(), anyString());
    }

    @Test
    void return_404_for_a_history_as_before() {
        given()
                .when()
                .get("/api/calm/namespaces/finos/decorators/1/history")
                .then()
                .statusCode(404)
                .body(containsString("Decorator with ID 1 does not exist in namespace: finos"));
    }

    @Test
    void return_404_for_a_history_in_an_unknown_namespace() {
        given()
                .when()
                .get("/api/calm/namespaces/other/decorators/1/history")
                .then()
                .statusCode(404)
                .body(containsString("Invalid namespace provided: other"));
    }
}
