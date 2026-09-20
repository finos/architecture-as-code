package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import org.finos.calm.domain.Domain;
import org.finos.calm.domain.controls.DomainControlCount;
import org.finos.calm.domain.exception.DomainAlreadyExistsException;
import org.finos.calm.domain.exception.DomainNotEmptyException;
import org.finos.calm.domain.exception.DomainNotFoundException;
import org.finos.calm.security.UserAccessValidator;
import org.finos.calm.services.CountsService;
import org.finos.calm.services.DomainService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static io.restassured.RestAssured.given;
import static org.finos.calm.resources.ResourceValidationConstants.DOMAIN_MESSAGE;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.mockito.Mockito.*;

@TestSecurity(authorizationEnabled = false)
@QuarkusTest
@ExtendWith(MockitoExtension.class)
public class TestDomainResourceShould {

    public static final String CALM_DOMAINS = "api/calm/domains";
    private static final String TEST_DOMAIN = "test-domain";

    @InjectMock
    DomainService mockDomainService;

    @InjectMock
    CountsService mockCountsService;

    // See the equivalent field in TestNamespaceResourceShould/TestSearchResourceShould:
    // @TestSecurity(authorizationEnabled = false) bypasses declarative permission checks but
    // not DomainResource's own ReadableScope lookup, so without this the identity-less test
    // principal resolves to zero grants instead of the unfiltered Optional.empty() these tests
    // expect — and, since UserAccessValidator is unconditionally registered, it's genuinely
    // invoked here, hitting the real UserAccessStore and hanging/timing out under test.
    @InjectMock
    UserAccessValidator mockUserAccessValidator;

    @BeforeEach
    void setUpUserAccessValidator() {
        lenient().when(mockUserAccessValidator.getReadableDomains(any())).thenReturn(Optional.empty());
    }

    @Test
    void return_an_empty_list_when_no_domains_exist() {
        when(mockDomainService.getDomains()).thenReturn(new ArrayList<>());

        given()
            .when().get(CALM_DOMAINS)
            .then()
            .statusCode(200)
            .body(is("{\"values\":[]}"));

        verify(mockDomainService).getDomains();
    }

    @Test
    void return_a_domain_list_when_domains_exist() {
        when(mockDomainService.getDomains()).thenReturn(List.of(TEST_DOMAIN));

        given()
            .when().get(CALM_DOMAINS)
            .then()
            .statusCode(200)
            .body(is("{\"values\":[\"test-domain\"]}"));

        verify(mockDomainService).getDomains();
    }

    @Test
    void return_an_empty_list_when_no_domain_counts_exist() {
        when(mockCountsService.getDomainCounts(any())).thenReturn(new ArrayList<>());

        given()
            .when().get(CALM_DOMAINS + "/counts")
            .then()
            .statusCode(200)
            .body(is("{\"values\":[]}"));

        verify(mockCountsService).getDomainCounts(any());
    }

    @Test
    void return_domain_control_counts_when_present() {
        when(mockCountsService.getDomainCounts(any())).thenReturn(List.of(new DomainControlCount(TEST_DOMAIN, 5)));

        given()
            .when().get(CALM_DOMAINS + "/counts")
            .then()
            .statusCode(200)
            .body("values[0].domain", is(TEST_DOMAIN))
            .body("values[0].controlCount", is(5));

        verify(mockCountsService).getDomainCounts(any());
    }

    @Test
    void create_a_domain_with_a_valid_name() throws DomainAlreadyExistsException {
        Domain expectedDomain = new Domain(TEST_DOMAIN);

        given()
            .header("Content-Type", "application/json")
            .body(expectedDomain)
            .when().post(CALM_DOMAINS)
            .then()
            .statusCode(201)
            .header("Location", "http://localhost:8081/api/calm/domains/" + TEST_DOMAIN);

        verify(mockDomainService).createDomain(TEST_DOMAIN);
    }

    @Test
    void create_a_domain_with_an_invalid_name_returns_a_400() throws DomainAlreadyExistsException {
        Domain invalidDomain = new Domain("invalid domain");

        given()
            .header("Content-Type", "application/json")
            .body(invalidDomain)
            .when().post(CALM_DOMAINS)
            .then()
            .statusCode(400)
            .body(containsString(DOMAIN_MESSAGE));

        verify(mockDomainService, never()).createDomain(any());
    }

    @Test
    void return_400_when_domain_name_is_the_reserved_GLOBAL_name() throws DomainAlreadyExistsException {
        given()
                .header("Content-Type", "application/json")
                .body(new Domain("GLOBAL"))
                .when().post(CALM_DOMAINS)
                .then()
                .statusCode(400)
                .body(containsString("reserved"));

        verify(mockDomainService, never()).createDomain(any());
    }

    @Test
    void return_400_when_domain_name_is_reserved_GLOBAL_case_insensitive() throws DomainAlreadyExistsException {
        given()
                .header("Content-Type", "application/json")
                .body(new Domain("global"))
                .when().post(CALM_DOMAINS)
                .then()
                .statusCode(400)
                .body(containsString("reserved"));

        verify(mockDomainService, never()).createDomain(any());
    }

    @Test
    void create_a_domain_that_already_exists_returns_a_409() throws DomainAlreadyExistsException {
        Domain expectedDomain = new Domain(TEST_DOMAIN);
        doThrow(new DomainAlreadyExistsException("Domain already exists"))
                .when(mockDomainService).createDomain(TEST_DOMAIN);

        given()
                .header("Content-Type", "application/json")
                .body(expectedDomain)
                .when().post(CALM_DOMAINS)
                .then()
                .statusCode(409);

        verify(mockDomainService).createDomain(TEST_DOMAIN);
    }

    @Test
    void delete_a_domain_successfully() throws Exception {
        given()
                .when().delete(CALM_DOMAINS + "/" + TEST_DOMAIN)
                .then()
                .statusCode(204);

        verify(mockDomainService).deleteDomain(TEST_DOMAIN);
    }

    @Test
    void return_404_when_deleting_a_missing_domain() throws Exception {
        doThrow(new DomainNotFoundException("missing"))
                .when(mockDomainService).deleteDomain("missing");

        given()
                .when().delete(CALM_DOMAINS + "/missing")
                .then()
                .statusCode(404);
    }

    @Test
    void return_409_when_deleting_a_domain_that_is_not_empty() throws Exception {
        doThrow(new DomainNotEmptyException(TEST_DOMAIN))
                .when(mockDomainService).deleteDomain(TEST_DOMAIN);

        given()
                .when().delete(CALM_DOMAINS + "/" + TEST_DOMAIN)
                .then()
                .statusCode(409)
                .body(containsString("contains controls"));
    }

    @Test
    void return_400_when_deleting_domain_with_invalid_format() throws Exception {
        given()
                .when().delete(CALM_DOMAINS + "/invalid_domain")
                .then()
                .statusCode(400)
                .body(containsString(DOMAIN_MESSAGE));

        verify(mockDomainService, never()).deleteDomain(any());
    }
}
