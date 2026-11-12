package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import org.finos.calm.store.DecoratorStore;
import org.finos.calm.store.github.GitHubDecoratorStore;
import org.finos.calm.store.github.registry.RegistrySnapshot;
import org.finos.calm.store.github.registry.ResourceRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
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
class TestDecoratorResourceGitHubModeShould {

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
