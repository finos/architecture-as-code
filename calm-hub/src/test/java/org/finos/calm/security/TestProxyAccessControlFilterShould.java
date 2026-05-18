package org.finos.calm.security;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ResourceInfo;
import jakarta.ws.rs.core.MultivaluedHashMap;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.UriInfo;
import org.apache.http.HttpStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.lang.reflect.Method;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.*;

@QuarkusTest
public class TestProxyAccessControlFilterShould {

    @Mock
    ContainerRequestContext requestContext;
    @Mock
    ResourceInfo resourceInfo;
    @Mock
    UserAccessValidator userAccessValidator;

    private ProxyAccessControlFilter filter;

    private static final String TEST_HEADER = "Remote-User";

    @BeforeEach
    void setup() {
        MockitoAnnotations.openMocks(this);
        filter = new ProxyAccessControlFilter(resourceInfo, userAccessValidator, TEST_HEADER);
    }

    @Test
    void allow_the_request_when_scopes_not_defined_on_resource() throws NoSuchMethodException {
        Method method = TestResource.class.getMethod("unsecuredEndpoint");
        when(resourceInfo.getResourceMethod()).thenReturn(method);

        filter.filter(requestContext);

        verify(requestContext, never()).abortWith(any());
    }

    @Test
    void reject_with_401_when_proxy_remote_user_header_is_absent() throws NoSuchMethodException {
        Method method = TestResource.class.getMethod("securedEndpoint");
        when(resourceInfo.getResourceMethod()).thenReturn(method);
        when(requestContext.getHeaderString(TEST_HEADER)).thenReturn(null);

        filter.filter(requestContext);

        verify(requestContext).abortWith(argThat(response -> response.getStatus() == HttpStatus.SC_UNAUTHORIZED));
    }

    @Test
    void reject_with_401_when_proxy_remote_user_header_is_blank() throws NoSuchMethodException {
        Method method = TestResource.class.getMethod("securedEndpoint");
        when(resourceInfo.getResourceMethod()).thenReturn(method);
        when(requestContext.getHeaderString(TEST_HEADER)).thenReturn("   ");

        filter.filter(requestContext);

        verify(requestContext).abortWith(argThat(response -> response.getStatus() == HttpStatus.SC_UNAUTHORIZED));
    }

    @Test
    void reject_with_403_when_user_lacks_access_grants() throws NoSuchMethodException {
        Method method = TestResource.class.getMethod("securedEndpoint");
        when(resourceInfo.getResourceMethod()).thenReturn(method);
        when(requestContext.getHeaderString(TEST_HEADER)).thenReturn("alice");
        when(requestContext.getMethod()).thenReturn("GET");

        UriInfo mockUriInfo = mock(UriInfo.class);
        when(mockUriInfo.getPath()).thenReturn("/calm/namespaces/finos/architectures");
        MultivaluedMap<String, String> pathParams = new MultivaluedHashMap<>();
        pathParams.add("namespace", "finos");
        when(mockUriInfo.getPathParameters()).thenReturn(pathParams);
        when(requestContext.getUriInfo()).thenReturn(mockUriInfo);

        when(userAccessValidator.isUserAuthorized(any(UserRequestAttributes.class))).thenReturn(false);

        filter.filter(requestContext);

        verify(requestContext).abortWith(argThat(response -> response.getStatus() == HttpStatus.SC_FORBIDDEN));
    }

    @Test
    void allow_request_when_user_has_required_access_grants() throws NoSuchMethodException {
        Method method = TestResource.class.getMethod("securedEndpoint");
        when(resourceInfo.getResourceMethod()).thenReturn(method);
        when(requestContext.getHeaderString(TEST_HEADER)).thenReturn("alice");
        when(requestContext.getMethod()).thenReturn("GET");

        UriInfo mockUriInfo = mock(UriInfo.class);
        when(mockUriInfo.getPath()).thenReturn("/calm/namespaces/finos/architectures");
        MultivaluedMap<String, String> pathParams = new MultivaluedHashMap<>();
        pathParams.add("namespace", "finos");
        when(mockUriInfo.getPathParameters()).thenReturn(pathParams);
        when(requestContext.getUriInfo()).thenReturn(mockUriInfo);

        when(userAccessValidator.isUserAuthorized(any(UserRequestAttributes.class))).thenReturn(true);

        filter.filter(requestContext);

        verify(requestContext, never()).abortWith(any());
    }

    private static class TestResource {
        @SuppressWarnings("unused")
        public List<String> unsecuredEndpoint() {
            return List.of();
        }

        @PermittedScopes({CalmHubScopes.ARCHITECTURES_READ})
        public void securedEndpoint() {
        }
    }
}
