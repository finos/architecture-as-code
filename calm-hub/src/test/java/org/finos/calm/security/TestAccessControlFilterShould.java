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
public class TestAccessControlFilterShould {

    @Mock
    JsonWebToken jwt;
    @Mock
    ContainerRequestContext requestContext;
    @Mock
    ResourceInfo resourceInfo;

    private AccessControlFilter accessControlFilter;

    @BeforeEach
    void setup() {
        MockitoAnnotations.openMocks(this);
        accessControlFilter = new AccessControlFilter(jwt, resourceInfo);
    }

    @Test
    void allow_the_request_when_scopes_not_defined_on_resource() throws NoSuchMethodException {
        Method method = TestNamespaceResource.class.getMethod("getNamespacesUnsecured");
        when(resourceInfo.getResourceMethod()).thenReturn(method);

        accessControlFilter.filter(requestContext);
        verify(requestContext, never()).abortWith(any());
    }

    @Test
    void allow_the_request_when_token_scopes_matching() throws NoSuchMethodException {
        Method method = TestNamespaceResource.class.getMethod("createNamespace");
        when(resourceInfo.getResourceMethod()).thenReturn(method);
        when(jwt.getClaim("scope")).thenReturn("openid architectures:all");

        accessControlFilter.filter(requestContext);
        verify(requestContext, never()).abortWith(any());
    }

    @Test
    void abort_the_request_when_token_scopes_not_matching() throws NoSuchMethodException {
        Method method = TestNamespaceResource.class.getMethod("createNamespace");
        when(resourceInfo.getResourceMethod()).thenReturn(method);
        when(jwt.getClaim("scope")).thenReturn("openid architectures:read");

        accessControlFilter.filter(requestContext);
        verify(requestContext)
                .abortWith(argThat(response -> response.getStatus() == HttpStatus.SC_FORBIDDEN));
    }

    private static class TestNamespaceResource {
        public List<String> getNamespacesUnsecured() {
            return List.of("test", "dev");
        }

        @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL})
        public void createNamespace() {
        }
    }
}