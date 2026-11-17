package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import org.finos.calm.domain.namespaces.PersonalNamespace;
import org.finos.calm.services.PersonalNamespaceService;
import org.finos.calm.services.PersonalNamespaceService.CreateOutcome;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.endsWith;
import static org.hamcrest.Matchers.equalTo;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@QuarkusTest
public class TestPersonalNamespaceResourceShould {

    private static final String PATH = "/api/calm/me/namespace";

    @InjectMock
    PersonalNamespaceService mockPersonalNamespaceService;

    @BeforeEach
    void setUp() {
        when(mockPersonalNamespaceService.isActive()).thenReturn(true);
        when(mockPersonalNamespaceService.namespaceFor("alice")).thenReturn(Optional.of("users.alice"));
    }

    @Test
    void return_401_when_not_authenticated() {
        given().when().get(PATH).then().statusCode(401);
        given().when().put(PATH).then().statusCode(401);
    }

    @Test
    @TestSecurity(user = "alice")
    void return_404_on_get_when_not_active() {
        when(mockPersonalNamespaceService.isActive()).thenReturn(false);

        given().when().get(PATH)
                .then().statusCode(404)
                .body(containsString("not enabled"));
    }

    @Test
    @TestSecurity(user = "alice")
    void return_404_on_put_when_not_active() {
        when(mockPersonalNamespaceService.isActive()).thenReturn(false);

        given().when().put(PATH)
                .then().statusCode(404)
                .body(containsString("not enabled"));
        verify(mockPersonalNamespaceService, never()).create(anyString());
    }

    @Test
    @TestSecurity(user = "alice")
    void return_the_state_of_the_namespace() {
        when(mockPersonalNamespaceService.get("alice"))
                .thenReturn(Optional.of(new PersonalNamespace("users.alice", true, false)));

        given().when().get(PATH)
                .then().statusCode(200)
                .body("name", equalTo("users.alice"))
                .body("exists", equalTo(true))
                .body("owned", equalTo(false));
    }

    @Test
    @TestSecurity(user = "alice")
    void return_422_on_get_for_an_unsupported_principal() {
        when(mockPersonalNamespaceService.get("alice")).thenReturn(Optional.empty());

        given().when().get(PATH).then().statusCode(422);
    }

    @Test
    @TestSecurity(user = "alice")
    void return_201_with_location_when_created() {
        when(mockPersonalNamespaceService.create("alice")).thenReturn(Optional.of(CreateOutcome.CREATED));

        given().when().put(PATH)
                .then().statusCode(201)
                .header("Location", endsWith("/api/calm/namespaces/users.alice"))
                .body("name", equalTo("users.alice"))
                .body("owned", equalTo(true));
    }

    @Test
    @TestSecurity(user = "alice")
    void return_200_when_already_owned() {
        when(mockPersonalNamespaceService.create("alice")).thenReturn(Optional.of(CreateOutcome.ALREADY_OWNED));

        given().when().put(PATH)
                .then().statusCode(200)
                .body("name", equalTo("users.alice"))
                .body("exists", equalTo(true));
    }

    @Test
    @TestSecurity(user = "alice")
    void return_409_when_taken() {
        when(mockPersonalNamespaceService.create("alice")).thenReturn(Optional.of(CreateOutcome.TAKEN));

        given().when().put(PATH)
                .then().statusCode(409)
                .body(containsString("another user"));
    }

    @Test
    @TestSecurity(user = "alice")
    void return_422_on_put_for_an_unsupported_principal() {
        when(mockPersonalNamespaceService.create("alice")).thenReturn(Optional.empty());

        given().when().put(PATH).then().statusCode(422);
    }
}
