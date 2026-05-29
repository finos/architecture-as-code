package org.finos.calm.security;

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

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestNoAuthAuthenticationMechanismShould {

    @Mock
    IdentityProviderManager mockIdentityProviderManager;

    @Mock
    RoutingContext mockRoutingContext;

    @Mock
    HttpServerRequest mockRequest;

    @Mock
    SecurityIdentity mockIdentity;

    NoAuthAuthenticationMechanism mechanism;

    @BeforeEach
    void setUp() {
        mechanism = new NoAuthAuthenticationMechanism();
    }

    @Test
    void return_empty_when_no_auth_disabled() {
        mechanism.noAuthEnabled = false;

        SecurityIdentity result = mechanism.authenticate(mockRoutingContext, mockIdentityProviderManager)
                .await().indefinitely();

        assertNull(result);
        verifyNoInteractions(mockIdentityProviderManager);
    }

    @Test
    void authenticate_with_no_auth_principal_when_no_auth_enabled() {
        mechanism.noAuthEnabled = true;
        when(mockRoutingContext.request()).thenReturn(mockRequest);
        when(mockRequest.path()).thenReturn("/test");
        when(mockIdentityProviderManager.authenticate(any(TrustedAuthenticationRequest.class)))
                .thenReturn(Uni.createFrom().item(mockIdentity));

        SecurityIdentity result = mechanism.authenticate(mockRoutingContext, mockIdentityProviderManager)
                .await().indefinitely();

        assertNotNull(result);
        verify(mockIdentityProviderManager).authenticate(any(TrustedAuthenticationRequest.class));
    }

    @Test
    void return_null_challenge() {
        ChallengeData challenge = mechanism.getChallenge(mockRoutingContext).await().indefinitely();

        assertNull(challenge);
    }
}
