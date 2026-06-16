package org.finos.calm.security;

import io.netty.handler.codec.http.HttpResponseStatus;
import io.quarkus.security.identity.IdentityProviderManager;
import io.quarkus.security.identity.SecurityIdentity;
import io.quarkus.security.identity.request.TrustedAuthenticationRequest;
import io.quarkus.vertx.http.runtime.security.ChallengeData;
import io.smallrye.mutiny.Uni;
import io.vertx.core.http.HttpServerRequest;
import io.vertx.ext.web.RoutingContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestProxyAuthenticationMechanismShould {

    @Mock
    IdentityProviderManager mockIdentityProviderManager;

    @Mock
    RoutingContext mockRoutingContext;

    @Mock
    HttpServerRequest mockRequest;

    @Mock
    SecurityIdentity mockIdentity;

    ProxyAuthenticationMechanism mechanism;

    @BeforeEach
    void setUp() {
        mechanism = new ProxyAuthenticationMechanism();
        mechanism.usernameHeader = "Remote-User";
    }

    @Test
    void return_empty_when_username_header_is_missing() {
        when(mockRoutingContext.request()).thenReturn(mockRequest);
        when(mockRequest.getHeader("Remote-User")).thenReturn(null);
        when(mockRequest.path()).thenReturn("/test");

        SecurityIdentity result = mechanism.authenticate(mockRoutingContext, mockIdentityProviderManager)
                .await().indefinitely();

        assertNull(result);
        verifyNoInteractions(mockIdentityProviderManager);
    }

    @Test
    void return_empty_when_username_header_is_empty() {
        when(mockRoutingContext.request()).thenReturn(mockRequest);
        when(mockRequest.getHeader("Remote-User")).thenReturn("");
        when(mockRequest.path()).thenReturn("/test");

        SecurityIdentity result = mechanism.authenticate(mockRoutingContext, mockIdentityProviderManager)
                .await().indefinitely();

        assertNull(result);
        verifyNoInteractions(mockIdentityProviderManager);
    }

    @Test
    void authenticate_user_when_valid_username_header_is_present() {
        when(mockRoutingContext.request()).thenReturn(mockRequest);
        when(mockRequest.getHeader("Remote-User")).thenReturn("alice");
        when(mockIdentityProviderManager.authenticate(any(TrustedAuthenticationRequest.class)))
                .thenReturn(Uni.createFrom().item(mockIdentity));

        SecurityIdentity result = mechanism.authenticate(mockRoutingContext, mockIdentityProviderManager)
                .await().indefinitely();

        assertNotNull(result);
        verify(mockIdentityProviderManager).authenticate(any(TrustedAuthenticationRequest.class));
    }

    @Test
    void return_401_challenge() {
        ChallengeData challenge = mechanism.getChallenge(mockRoutingContext).await().indefinitely();

        assertNotNull(challenge);
        assertEquals(HttpResponseStatus.UNAUTHORIZED.code(), challenge.status);
    }
}
