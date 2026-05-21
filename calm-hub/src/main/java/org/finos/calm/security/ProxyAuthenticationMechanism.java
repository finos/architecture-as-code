package org.finos.calm.security;

import io.netty.handler.codec.http.HttpResponseStatus;
import io.quarkus.arc.profile.IfBuildProfile;
import io.quarkus.oidc.AccessTokenCredential;
import io.quarkus.oidc.BearerTokenAuthentication;
import io.quarkus.runtime.util.StringUtil;
import io.quarkus.security.identity.IdentityProviderManager;
import io.quarkus.security.identity.SecurityIdentity;
import io.quarkus.security.identity.request.AuthenticationRequest;
import io.quarkus.security.identity.request.TrustedAuthenticationRequest;
import io.quarkus.security.runtime.QuarkusPrincipal;
import io.quarkus.security.runtime.QuarkusSecurityIdentity;
import io.quarkus.vertx.http.runtime.security.ChallengeData;
import io.quarkus.vertx.http.runtime.security.HttpAuthenticationMechanism;
import io.smallrye.mutiny.Uni;
import io.vertx.ext.web.RoutingContext;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Optional;
import java.util.Set;

@ApplicationScoped
@IfBuildProfile("proxy-auth")
public class ProxyAuthenticationMechanism implements HttpAuthenticationMechanism {
    private static final Logger logger = LoggerFactory.getLogger(ProxyAuthenticationMechanism.class);

    @ConfigProperty(name = "calm.security.proxy.username-header", defaultValue = "Remote-User")
    String usernameHeader;

    @Override
    public Uni<SecurityIdentity> authenticate(RoutingContext context, IdentityProviderManager identityProviderManager) {
        String username = context.request().getHeader(usernameHeader);
        if (StringUtil.isNullOrEmpty(username)) {
            logger.error("REJECTING request with missing proxy authentication header {}. Path: {}", usernameHeader, context.request().path());
            return Uni.createFrom().optional(Optional.empty());
        }
        logger.debug("Setting user identity to value from proxy authentication header {}: {}", usernameHeader, username);
        return Uni.createFrom()
                .item(QuarkusSecurityIdentity.builder()
                        .setPrincipal(new QuarkusPrincipal(username))
                        .setAnonymous(false)
                        .build());
//        TrustedAuthenticationRequest request = new TrustedAuthenticationRequest(username);
//        return identityProviderManager.authenticate(request);
//        return Uni.createFrom().item(QuarkusSecurityIdentity.builder().setPrincipal(new QuarkusPrincipal(username)).build());
    }

    @Override
    public Uni<ChallengeData> getChallenge(RoutingContext context) {
        return Uni.createFrom().item(
                new ChallengeData(HttpResponseStatus.UNAUTHORIZED.code(), null, null));
    }

//    @Override
//    public Set<Class<? extends AuthenticationRequest>> getCredentialTypes() {
//        return Set.of(TrustedAuthenticationRequest.class);
//    }
}
