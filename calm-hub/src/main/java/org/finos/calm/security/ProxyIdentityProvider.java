package org.finos.calm.security;

import io.quarkus.arc.profile.IfBuildProfile;
import io.quarkus.security.identity.AuthenticationRequestContext;
import io.quarkus.security.identity.IdentityProvider;
import io.quarkus.security.identity.SecurityIdentity;
import io.quarkus.security.identity.request.TrustedAuthenticationRequest;
import io.quarkus.security.runtime.QuarkusPrincipal;
import io.quarkus.security.runtime.QuarkusSecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@ApplicationScoped
@IfBuildProfile("proxy-auth")
public class ProxyIdentityProvider implements IdentityProvider<TrustedAuthenticationRequest> {
    Logger logger = LoggerFactory.getLogger(ProxyIdentityProvider.class);

    @Override
    public Class<TrustedAuthenticationRequest> getRequestType() {
        return TrustedAuthenticationRequest.class;
    }

    @Override
    public Uni<SecurityIdentity> authenticate(TrustedAuthenticationRequest request,
            AuthenticationRequestContext context) {
        logger.debug("Receiving identity from ProxyAuthenticationMechanism - validating as no-op as no IDP is configured for proxy mode.");
        return Uni.createFrom().item(QuarkusSecurityIdentity.builder()
                .setPrincipal(new QuarkusPrincipal(request.getPrincipal()))
                .setAnonymous(false)
                .build());
    }
}
