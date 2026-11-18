package org.finos.calm.security;

import io.netty.handler.codec.http.HttpHeaderNames;
import io.quarkus.security.AuthenticationFailedException;
import io.quarkus.security.identity.IdentityProviderManager;
import io.quarkus.security.identity.SecurityIdentity;
import io.quarkus.vertx.http.runtime.security.ChallengeData;
import io.quarkus.vertx.http.runtime.security.HttpAuthenticationMechanism;
import io.smallrye.mutiny.Uni;
import io.vertx.ext.web.RoutingContext;
import jakarta.enterprise.context.ApplicationScoped;
import org.finos.calm.extensions.ExtensionIdentitySigner;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Hub never accepts its own extension identity assertion as a credential (ADR 0010). An extension
 * calls Hub with its own service account. This mechanism runs before the others, in every auth
 * mode, and fails a request whose bearer token has the assertion {@code typ}. It never supplies an
 * identity itself.
 */
@ApplicationScoped
public class ExtensionAssertionRejectingMechanism implements HttpAuthenticationMechanism {

    private static final Logger logger = LoggerFactory.getLogger(ExtensionAssertionRejectingMechanism.class);
    private static final String BEARER = "bearer ";
    private static final String INVALID_TOKEN = "Bearer error=\"invalid_token\"";

    @Override
    public Uni<SecurityIdentity> authenticate(RoutingContext context, IdentityProviderManager identityProviderManager) {
        if (presentsAssertion(context)) {
            logger.warn("REJECTING a CALM Hub extension identity assertion presented as a credential");
            return Uni.createFrom().failure(new AuthenticationFailedException());
        }
        return Uni.createFrom().nullItem();
    }

    @Override
    public Uni<ChallengeData> getChallenge(RoutingContext context) {
        // Hub answers an assertion itself: the OIDC challenge needs the identity provider, so while the
        // provider is down it would turn the 401 into a 500. The other mechanisms set every other challenge.
        return presentsAssertion(context)
                ? Uni.createFrom().item(new ChallengeData(401, HttpHeaderNames.WWW_AUTHENTICATE, INVALID_TOKEN))
                : Uni.createFrom().nullItem();
    }

    private static boolean presentsAssertion(RoutingContext context) {
        String authorization = context.request().getHeader(HttpHeaderNames.AUTHORIZATION);
        return authorization != null && authorization.regionMatches(true, 0, BEARER, 0, BEARER.length())
                && ExtensionIdentitySigner.isAssertion(authorization.substring(BEARER.length()).trim());
    }

    @Override
    public int getPriority() {
        return DEFAULT_PRIORITY + 1000;
    }
}
