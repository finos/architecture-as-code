package org.finos.calm.resources;

import jakarta.enterprise.inject.Instance;
import org.eclipse.microprofile.jwt.JsonWebToken;
import org.finos.calm.domain.search.GroupedSearchResults;
import org.finos.calm.domain.search.SearchResult;
import org.finos.calm.security.UserAccessValidator;
import org.finos.calm.store.SearchStore;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests that {@link SearchResource} resolves the caller's readable namespaces and
 * delegates filtering to the {@link SearchStore}. The store is responsible for
 * applying namespace filtering before the per-type cap so that authorisation cannot
 * silently drop legitimate results that fall beyond the unfiltered cap (regression
 * test for PR #2366 review feedback).
 */
@ExtendWith(MockitoExtension.class)
class TestSearchResourceFilteringShould {

    @Mock
    private SearchStore mockSearchStore;

    @SuppressWarnings("unchecked")
    @Mock
    private Instance<UserAccessValidator> mockValidatorInstance;

    @SuppressWarnings("unchecked")
    @Mock
    private Instance<JsonWebToken> mockJwtInstance;

    @Mock
    private UserAccessValidator mockValidator;

    @Mock
    private JsonWebToken mockJwt;

    @SuppressWarnings({"unchecked", "rawtypes"})
    private ArgumentCaptor<Optional<Set<String>>> namespacesCaptor() {
        return ArgumentCaptor.forClass((Class) Optional.class);
    }

    private GroupedSearchResults emptyResults() {
        return new GroupedSearchResults(
                List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of()
        );
    }

    @Test
    void pass_resolved_readable_namespaces_to_store_in_secure_mode() {
        when(mockValidatorInstance.isResolvable()).thenReturn(true);
        when(mockJwtInstance.isResolvable()).thenReturn(true);
        when(mockJwtInstance.get()).thenReturn(mockJwt);
        when(mockJwt.<String>getClaim("preferred_username")).thenReturn("testuser");
        when(mockValidatorInstance.get()).thenReturn(mockValidator);
        when(mockValidator.getReadableNamespaces("testuser")).thenReturn(Set.of("finos"));

        GroupedSearchResults storeResults = new GroupedSearchResults(
                List.of(new SearchResult("finos", 1, "Arch 1", "desc")),
                List.of(), List.of(), List.of(), List.of(), List.of(), List.of()
        );
        when(mockSearchStore.search(eq("test"), any())).thenReturn(storeResults);

        SearchResource resource = new SearchResource(mockSearchStore, mockValidatorInstance, mockJwtInstance);
        var response = resource.search("test");

        assertEquals(200, response.getStatus());

        ArgumentCaptor<Optional<Set<String>>> captor = namespacesCaptor();
        verify(mockSearchStore).search(eq("test"), captor.capture());
        Optional<Set<String>> passed = captor.getValue();
        assertTrue(passed.isPresent(), "secure-mode call must pass a populated Optional");
        assertEquals(Set.of("finos"), passed.get());
    }

    @Test
    void pass_empty_optional_when_validator_not_resolvable() {
        when(mockValidatorInstance.isResolvable()).thenReturn(false);

        when(mockSearchStore.search(eq("test"), any())).thenReturn(emptyResults());

        SearchResource resource = new SearchResource(mockSearchStore, mockValidatorInstance, mockJwtInstance);
        resource.search("test");

        ArgumentCaptor<Optional<Set<String>>> captor = namespacesCaptor();
        verify(mockSearchStore).search(eq("test"), captor.capture());
        assertFalse(captor.getValue().isPresent());
    }

    @Test
    void pass_empty_optional_when_jwt_has_no_username() {
        when(mockValidatorInstance.isResolvable()).thenReturn(true);
        when(mockJwtInstance.isResolvable()).thenReturn(true);
        when(mockJwtInstance.get()).thenReturn(mockJwt);
        when(mockJwt.<String>getClaim("preferred_username")).thenReturn(null);

        when(mockSearchStore.search(eq("test"), any())).thenReturn(emptyResults());

        SearchResource resource = new SearchResource(mockSearchStore, mockValidatorInstance, mockJwtInstance);
        resource.search("test");

        ArgumentCaptor<Optional<Set<String>>> captor = namespacesCaptor();
        verify(mockSearchStore).search(eq("test"), captor.capture());
        assertFalse(captor.getValue().isPresent());
    }

    @Test
    void pass_empty_set_when_user_has_no_namespace_grants() {
        when(mockValidatorInstance.isResolvable()).thenReturn(true);
        when(mockJwtInstance.isResolvable()).thenReturn(true);
        when(mockJwtInstance.get()).thenReturn(mockJwt);
        when(mockJwt.<String>getClaim("preferred_username")).thenReturn("testuser");
        when(mockValidatorInstance.get()).thenReturn(mockValidator);
        when(mockValidator.getReadableNamespaces("testuser")).thenReturn(Set.of());

        when(mockSearchStore.search(eq("test"), any())).thenReturn(emptyResults());

        SearchResource resource = new SearchResource(mockSearchStore, mockValidatorInstance, mockJwtInstance);
        resource.search("test");

        ArgumentCaptor<Optional<Set<String>>> captor = namespacesCaptor();
        verify(mockSearchStore).search(eq("test"), captor.capture());
        assertTrue(captor.getValue().isPresent());
        assertTrue(captor.getValue().get().isEmpty());
    }

    @Test
    void sanitize_log_query_strips_crlf_and_control_characters() {
        String malicious = "evil\r\n[INFO] forged log entry\twith\u0000nul";
        String sanitized = SearchResource.sanitizeForLog(malicious);
        assertFalse(sanitized.contains("\r"));
        assertFalse(sanitized.contains("\n"));
        assertFalse(sanitized.contains("\t"));
        assertFalse(sanitized.contains("\u0000"));
    }

    @Test
    void sanitize_log_query_truncates_long_input() {
        String longQuery = "a".repeat(200);
        String sanitized = SearchResource.sanitizeForLog(longQuery);
        assertTrue(sanitized.length() <= 200);
        assertTrue(sanitized.endsWith("..."));
    }

    @Test
    void sanitize_log_query_handles_null() {
        assertEquals("null", SearchResource.sanitizeForLog(null));
    }
}
