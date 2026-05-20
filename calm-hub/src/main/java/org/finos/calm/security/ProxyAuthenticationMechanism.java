package org.finos.calm.security;

import io.netty.handler.codec.http.HttpResponseStatus;
import io.quarkus.arc.profile.IfBuildProfile;
import io.quarkus.oidc.AccessTokenCredential;
import io.quarkus.oidc.BearerTokenAuthentication;
import io.quarkus.runtime.util.StringUtil;
import io.quarkus.security.identity.IdentityProviderManager;
import io.quarkus.security.identity.SecurityIdentity;
import io.quarkus.security.runtime.QuarkusPrincipal;
import io.quarkus.security.runtime.QuarkusSecurityIdentity;
import io.quarkus.vertx.http.runtime.security.ChallengeData;
import io.quarkus.vertx.http.runtime.security.HttpAuthenticationMechanism;
import io.smallrye.mutiny.Uni;
import io.vertx.ext.web.RoutingContext;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.util.Optional;

@ApplicationScoped
@IfBuildProfile("proxy-auth")
public class ProxyAuthenticationMechanism implements HttpAuthenticationMechanism {
    @ConfigProperty(name = "calm.security.proxy.username-header", defaultValue = "Remote-User")
    String usernameHeader;

    @Override
    public Uni<SecurityIdentity> authenticate(RoutingContext context, IdentityProviderManager identityProviderManager) {
        String username = context.request().getHeader(usernameHeader);
        if (StringUtil.isNullOrEmpty(username)) {
            return Uni.createFrom().optional(Optional.empty());
        }
        return Uni.createFrom()
                .item(QuarkusSecurityIdentity.builder()
                        .setPrincipal(new QuarkusPrincipal(username))
                        .build());
    }

    @Override
    public Uni<ChallengeData> getChallenge(RoutingContext context) {
        return Uni.createFrom().item(
                new ChallengeData(HttpResponseStatus.UNAUTHORIZED.code(), null, null));
    }
}
