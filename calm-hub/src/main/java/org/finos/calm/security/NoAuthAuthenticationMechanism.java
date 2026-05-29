package org.finos.calm.security;

import io.quarkus.security.identity.IdentityProviderManager;
import io.quarkus.security.identity.SecurityIdentity;
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

/**
 * When calm.hub.no.auth.enabled=true (the default profile), every request is given a
 * non-anonymous identity so that Quarkus calls the @PermissionChecker methods rather than
 * short-circuiting with 401. The checkers then grant access unconditionally via the same flag.
 *
 * In secure and proxy-auth profiles this mechanism is disabled via config and is a no-op.
 */
@ApplicationScoped
public class NoAuthAuthenticationMechanism implements HttpAuthenticationMechanism {

    private static final Logger logger = LoggerFactory.getLogger(NoAuthAuthenticationMechanism.class);
    static final String NO_AUTH_PRINCIPAL = "no-auth";

    @ConfigProperty(name = "calm.hub.no.auth.enabled", defaultValue = "false")
    boolean noAuthEnabled;

    @Override
    public Uni<SecurityIdentity> authenticate(RoutingContext context, IdentityProviderManager identityProviderManager) {
        if (!noAuthEnabled) {
            return Uni.createFrom().optional(Optional.empty());
        }
        logger.debug("No-auth mode: granting open identity to request for {}", context.request().path());
        return identityProviderManager.authenticate(new TrustedAuthenticationRequest(NO_AUTH_PRINCIPAL));
    }

    @Override
    public Uni<ChallengeData> getChallenge(RoutingContext context) {
        return Uni.createFrom().nullItem();
    }
}
