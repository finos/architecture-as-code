package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.finos.calm.domain.Domain;
import org.finos.calm.domain.exception.DomainAlreadyExistsException;
import org.finos.calm.store.DomainStore;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.is;
import static org.mockito.Mockito.*;

@QuarkusTest
@ExtendWith(MockitoExtension.class)
public class TestDomainSchemaResourceShould {

    @InjectMock
    DomainStore mockControlStore;

    private static final String TEST_DOMAIN = "test-domain";

    @Test
    void return_an_empty_list_when_no_domains_exist() {
        when(mockControlStore.getDomains()).thenReturn(new ArrayList<>());

        given()
            .when().get("calm/controls/domains")
            .then()
            .statusCode(200)
            .body(is("{\"values\":[]}"));

        verify(mockControlStore).getDomains();
    }

    @Test
    void return_a_domain_list_when_domains_exist() {
        when(mockControlStore.getDomains()).thenReturn(List.of(TEST_DOMAIN));

        given()
            .when().get("calm/controls/domains")
            .then()
            .statusCode(200)
            .body(is("{\"values\":[\"test-domain\"]}"));

        verify(mockControlStore).getDomains();
    }

    @Test
    void create_a_domain_with_a_valid_name() throws DomainAlreadyExistsException {
        Domain expectedDomain = new Domain(TEST_DOMAIN);
        when(mockControlStore.createDomain("test-domain")).thenReturn(expectedDomain);

        given()
            .header("Content-Type", "application/json")
            .body(expectedDomain)
            .when().post("calm/controls/domains")
            .then()
            .statusCode(201)
            .header("Location", "http://localhost:8081/calm/domains/" + expectedDomain.getName());

        verify(mockControlStore).createDomain("test-domain");
    }

    @Test
    void create_a_domain_with_an_invalid_name_returns_a_400() throws DomainAlreadyExistsException {
        Domain invalidDomain = new Domain("invalid domain");

        given()
            .header("Content-Type", "application/json")
            .body(invalidDomain)
            .when().post("calm/controls/domains")
            .then()
            .statusCode(400)
            .body(is("{\"error\":\"Invalid domain name\"}"));

        verify(mockControlStore, never()).createDomain("invalid-domain");
    }

    @Test
    void create_a_domain_that_already_exists_returns_a_409() throws DomainAlreadyExistsException {
        Domain expectedDomain = new Domain(TEST_DOMAIN);
        when(mockControlStore.createDomain("test-domain")).thenThrow(new DomainAlreadyExistsException("Domain already exists"));

        given()
                .header("Content-Type", "application/json")
                .body(expectedDomain)
                .when().post("calm/controls/domains")
                .then()
                .statusCode(409);

        verify(mockControlStore).createDomain("test-domain");
    }
}
