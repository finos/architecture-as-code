package org.finos.calm.security;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

@QuarkusTest
public class TestReadOnlyRequestFilterShould {

    @Mock
    ContainerRequestContext requestContext;

    @Mock
    UriInfo uriInfo;

    private ReadOnlyRequestFilter filter;

    @BeforeEach
    void setup() {
        MockitoAnnotations.openMocks(this);
        filter = new ReadOnlyRequestFilter();
        when(requestContext.getUriInfo()).thenReturn(uriInfo);
        when(uriInfo.getPath()).thenReturn("/calm/namespaces");
    }

    @ParameterizedTest
    @ValueSource(strings = {"POST", "PUT", "DELETE", "PATCH"})
    void reject_mutating_methods_on_calm_path_when_readonly(String method) {
        filter.readOnly = true;
        when(requestContext.getMethod()).thenReturn(method);

        filter.filter(requestContext);

        ArgumentCaptor<Response> captor = ArgumentCaptor.forClass(Response.class);
        verify(requestContext).abortWith(captor.capture());
        assertEquals(405, captor.getValue().getStatus());
        assertEquals("GET, HEAD, OPTIONS", captor.getValue().getHeaderString("Allow"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"GET", "HEAD", "OPTIONS"})
    void allow_read_methods_on_calm_path_when_readonly(String method) {
        filter.readOnly = true;
        when(requestContext.getMethod()).thenReturn(method);

        filter.filter(requestContext);

        verify(requestContext, never()).abortWith(any());
    }

    @ParameterizedTest
    @ValueSource(strings = {"POST", "PUT", "DELETE", "PATCH"})
    void allow_mutating_methods_when_not_readonly(String method) {
        filter.readOnly = false;
        when(requestContext.getMethod()).thenReturn(method);

        filter.filter(requestContext);

        verify(requestContext, never()).abortWith(any());
    }

    @ParameterizedTest
    @ValueSource(strings = {"POST", "PUT", "DELETE", "PATCH"})
    void allow_mutating_methods_on_non_calm_paths_when_readonly(String method) {
        filter.readOnly = true;
        when(requestContext.getMethod()).thenReturn(method);
        when(uriInfo.getPath()).thenReturn("/q/health");

        filter.filter(requestContext);

        verify(requestContext, never()).abortWith(any());
    }
}
