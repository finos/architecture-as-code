package org.finos.calm.resources;

import jakarta.enterprise.inject.Instance;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;
import org.finos.calm.domain.search.GroupedSearchResults;
import org.finos.calm.domain.search.SearchResult;
import org.finos.calm.security.UserAccessValidator;
import org.finos.calm.store.SearchStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TestSearchResourceFilteringShould {

    private SearchStore searchStore;
    private Instance<UserAccessValidator> validatorInstance;
    private Instance<JsonWebToken> jwtInstance;
    private UserAccessValidator validator;
    private JsonWebToken jwt;

    @SuppressWarnings("unchecked")
    @BeforeEach
    void setUp() {
        searchStore = mock(SearchStore.class);
        validatorInstance = mock(Instance.class);
        jwtInstance = mock(Instance.class);
        validator = mock(UserAccessValidator.class);
        jwt = mock(JsonWebToken.class);
    }

    @Test
    void filter_results_by_user_readable_namespaces_in_secure_mode() {
        when(validatorInstance.isResolvable()).thenReturn(true);
        when(jwtInstance.isResolvable()).thenReturn(true);
        when(jwtInstance.get()).thenReturn(jwt);
        when(jwt.<String>getClaim("preferred_username")).thenReturn("testuser");
        when(validatorInstance.get()).thenReturn(validator);
        when(validator.getReadableNamespaces("testuser")).thenReturn(Set.of("finos"));

        GroupedSearchResults rawResults = new GroupedSearchResults(
                List.of(new SearchResult("finos", 1, "Arch 1", "desc"),
                        new SearchResult("secret-ns", 2, "Arch 2", "desc")),
                List.of(new SearchResult("secret-ns", 3, "Pattern 1", "desc")),
                List.of(),
                List.of(),
                List.of(),
                List.of(new SearchResult("finos", 4, "Control 1", "desc")),
                List.of()
        );

        when(searchStore.search("test")).thenReturn(rawResults);

        SearchResource resource = new SearchResource(searchStore, validatorInstance, jwtInstance);
        Response response = resource.search("test");

        assertEquals(200, response.getStatus());
        GroupedSearchResults filtered = (GroupedSearchResults) response.getEntity();
        assertEquals(1, filtered.getArchitectures().size());
        assertEquals("finos", filtered.getArchitectures().get(0).getNamespace());
        assertEquals(0, filtered.getPatterns().size());
        assertEquals(1, filtered.getControls().size());
    }

    @Test
    void return_all_results_when_validator_not_resolvable() {
        when(validatorInstance.isResolvable()).thenReturn(false);
        when(jwtInstance.isResolvable()).thenReturn(false);

        GroupedSearchResults rawResults = new GroupedSearchResults(
                List.of(new SearchResult("finos", 1, "Arch 1", "desc"),
                        new SearchResult("secret-ns", 2, "Arch 2", "desc")),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of()
        );

        when(searchStore.search("test")).thenReturn(rawResults);

        SearchResource resource = new SearchResource(searchStore, validatorInstance, jwtInstance);
        Response response = resource.search("test");

        assertEquals(200, response.getStatus());
        GroupedSearchResults results = (GroupedSearchResults) response.getEntity();
        assertEquals(2, results.getArchitectures().size());
    }

    @Test
    void skip_filtering_when_jwt_has_no_username() {
        when(validatorInstance.isResolvable()).thenReturn(true);
        when(jwtInstance.isResolvable()).thenReturn(true);
        when(jwtInstance.get()).thenReturn(jwt);
        when(jwt.<String>getClaim("preferred_username")).thenReturn(null);

        GroupedSearchResults rawResults = new GroupedSearchResults(
                List.of(new SearchResult("finos", 1, "Arch 1", "desc"),
                        new SearchResult("secret-ns", 2, "Arch 2", "desc")),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of()
        );

        when(searchStore.search("test")).thenReturn(rawResults);

        SearchResource resource = new SearchResource(searchStore, validatorInstance, jwtInstance);
        Response response = resource.search("test");

        assertEquals(200, response.getStatus());
        GroupedSearchResults results = (GroupedSearchResults) response.getEntity();
        assertEquals(2, results.getArchitectures().size());
    }

    @Test
    void return_empty_results_when_user_has_no_namespace_grants() {
        when(validatorInstance.isResolvable()).thenReturn(true);
        when(jwtInstance.isResolvable()).thenReturn(true);
        when(jwtInstance.get()).thenReturn(jwt);
        when(jwt.<String>getClaim("preferred_username")).thenReturn("testuser");
        when(validatorInstance.get()).thenReturn(validator);
        when(validator.getReadableNamespaces("testuser")).thenReturn(Set.of());

        GroupedSearchResults rawResults = new GroupedSearchResults(
                List.of(new SearchResult("finos", 1, "Arch 1", "desc")),
                List.of(new SearchResult("finos", 2, "Pattern 1", "desc")),
                List.of(new SearchResult("finos", 3, "Flow 1", "desc")),
                List.of(new SearchResult("finos", 4, "Standard 1", "desc")),
                List.of(new SearchResult("finos", 5, "Interface 1", "desc")),
                List.of(new SearchResult("finos", 6, "Control 1", "desc")),
                List.of(new SearchResult("finos", 7, "ADR 1", "desc"))
        );

        when(searchStore.search("test")).thenReturn(rawResults);

        SearchResource resource = new SearchResource(searchStore, validatorInstance, jwtInstance);
        Response response = resource.search("test");

        assertEquals(200, response.getStatus());
        GroupedSearchResults filtered = (GroupedSearchResults) response.getEntity();
        assertEquals(0, filtered.getArchitectures().size());
        assertEquals(0, filtered.getPatterns().size());
        assertEquals(0, filtered.getFlows().size());
        assertEquals(0, filtered.getStandards().size());
        assertEquals(0, filtered.getInterfaces().size());
        assertEquals(0, filtered.getControls().size());
        assertEquals(0, filtered.getAdrs().size());
    }

    @Test
    void filter_across_all_resource_types_by_namespace() {
        when(validatorInstance.isResolvable()).thenReturn(true);
        when(jwtInstance.isResolvable()).thenReturn(true);
        when(jwtInstance.get()).thenReturn(jwt);
        when(jwt.<String>getClaim("preferred_username")).thenReturn("testuser");
        when(validatorInstance.get()).thenReturn(validator);
        when(validator.getReadableNamespaces("testuser")).thenReturn(Set.of("finos", "workshop"));

        GroupedSearchResults rawResults = new GroupedSearchResults(
                List.of(new SearchResult("finos", 1, "Arch", "d"),
                        new SearchResult("secret", 2, "Arch2", "d")),
                List.of(new SearchResult("workshop", 3, "Pat", "d")),
                List.of(new SearchResult("secret", 4, "Flow", "d")),
                List.of(new SearchResult("finos", 5, "Std", "d")),
                List.of(new SearchResult("workshop", 6, "Iface", "d"),
                        new SearchResult("secret", 7, "Iface2", "d")),
                List.of(new SearchResult("finos", 8, "Ctrl", "d")),
                List.of(new SearchResult("secret", 9, "ADR", "d"),
                        new SearchResult("finos", 10, "ADR2", "d"))
        );

        when(searchStore.search("demo")).thenReturn(rawResults);

        SearchResource resource = new SearchResource(searchStore, validatorInstance, jwtInstance);
        Response response = resource.search("demo");

        assertEquals(200, response.getStatus());
        GroupedSearchResults filtered = (GroupedSearchResults) response.getEntity();
        assertEquals(1, filtered.getArchitectures().size());
        assertEquals(1, filtered.getPatterns().size());
        assertEquals(0, filtered.getFlows().size());
        assertEquals(1, filtered.getStandards().size());
        assertEquals(1, filtered.getInterfaces().size());
        assertEquals(1, filtered.getControls().size());
        assertEquals(1, filtered.getAdrs().size());
    }
}
