package org.finos.calm.security;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ResourceInfo;
import org.apache.http.HttpStatus;
import org.eclipse.microprofile.jwt.JsonWebToken;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.lang.reflect.Method;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.never;

@QuarkusTest
public class TestScopesAllowedFilterShould {

    @Mock
    JsonWebToken jwt;
    @Mock
    ContainerRequestContext requestContext;
    @Mock
    ResourceInfo resourceInfo;

    private ScopesAllowedFilter scopesAllowedFilter;

    @BeforeEach
    public void setup() {
        MockitoAnnotations.openMocks(this);
        scopesAllowedFilter = new ScopesAllowedFilter(jwt, resourceInfo);
    }

    @Test
    public void allow_the_request_when_scopes_not_defined_on_resource() throws NoSuchMethodException {
        Method method = TestNamespaceResource.class.getMethod("getNamespacesUnsecured");
        when(resourceInfo.getResourceMethod()).thenReturn(method);

        scopesAllowedFilter.filter(requestContext);
        //verify(logger).warn("Unsecured endpoint accessed: "+ method);
        verify(requestContext, never()).abortWith(any());
    }

    @Test
    public void allow_the_request_when_token_scopes_matching() throws NoSuchMethodException {
        Method method = TestNamespaceResource.class.getMethod("createNamespace");
        when(resourceInfo.getResourceMethod()).thenReturn(method);
        when(jwt.getClaim("scope")).thenReturn("openid architectures:all");

        scopesAllowedFilter.filter(requestContext);
        //verify(logger).info("Request allowed, ScopesAllowed are: [architectures:all], there is a matching scope found in accessToken: openid architectures:all");
        verify(requestContext, never()).abortWith(any());
    }

    @Test
    public void abort_the_request_when_token_scopes_not_matching() throws NoSuchMethodException {
        Method method = TestNamespaceResource.class.getMethod("createNamespace");
        when(resourceInfo.getResourceMethod()).thenReturn(method);
        when(jwt.getClaim("scope")).thenReturn("openid architectures:read");

        scopesAllowedFilter.filter(requestContext);
        //verify(logger).error("Request denied, ScopesAllowed are: [architectures:all], no matching scopes found in accessToken: openid architectures:read");
        verify(requestContext)
                .abortWith(argThat(response -> response.getStatus() == HttpStatus.SC_FORBIDDEN));
    }

    private static class TestNamespaceResource {
        public List<String> getNamespacesUnsecured() {
            return List.of("test", "dev");
        }

        @ScopesAllowed({"architectures:all"})
        public void createNamespace() {
        }
    }
}
