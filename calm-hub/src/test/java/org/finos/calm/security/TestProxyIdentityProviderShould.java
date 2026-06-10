package org.finos.calm.security;

import io.quarkus.security.identity.AuthenticationRequestContext;
import io.quarkus.security.identity.SecurityIdentity;
import io.quarkus.security.identity.request.TrustedAuthenticationRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;

@ExtendWith(MockitoExtension.class)
class TestProxyIdentityProviderShould {

    @Mock
    AuthenticationRequestContext mockContext;

    ProxyIdentityProvider provider;

    @BeforeEach
    void setUp() {
        provider = new ProxyIdentityProvider();
    }

    @Test
    void return_trusted_authentication_request_type() {
        assertEquals(TrustedAuthenticationRequest.class, provider.getRequestType());
    }

    @Test
    void build_non_anonymous_identity_with_principal_from_request() {
        TrustedAuthenticationRequest request = new TrustedAuthenticationRequest("alice");

        SecurityIdentity identity = provider.authenticate(request, mockContext)
                .await().indefinitely();

        assertNotNull(identity);
        assertFalse(identity.isAnonymous());
        assertEquals("alice", identity.getPrincipal().getName());
    }
}
