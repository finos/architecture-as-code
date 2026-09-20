package org.finos.calm.resources;

import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Serves OIDC configuration to the frontend at startup.
 * This endpoint is unauthenticated — it must be reachable before the user logs in
 * so the frontend knows which OIDC library to load and where to redirect.
 */
@Path("/api/calm/auth")
@Produces(MediaType.APPLICATION_JSON)
public class AuthConfigResource {

    @Inject
    @ConfigProperty(name = "quarkus.oidc.tenant-enabled", defaultValue = "false")
    boolean oidcTenantEnabled;

    @Inject
    @ConfigProperty(name = "calm.oidc.provider", defaultValue = "generic-oidc")
    Optional<String> oidcProvider;

    @Inject
    @ConfigProperty(name = "quarkus.oidc.auth-server-url", defaultValue = "")
    Optional<String> oidcAuthority;

    @Inject
    @ConfigProperty(name = "quarkus.oidc.client-id", defaultValue = "")
    Optional<String> oidcClientId;

    @Inject
    @ConfigProperty(name = "calm.oidc.scopes", defaultValue = "openid profile email")
    Optional<String> oidcScopes;

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @GET
    @Path("/config")
    public Response getAuthConfig() {
        Map<String, Object> response = new HashMap<>();

        Map<String, Object> oidc = new HashMap<>();
        oidc.put("enabled", oidcTenantEnabled);
        if (oidcTenantEnabled) {
            oidc.put("provider", oidcProvider.orElse("generic-oidc"));
            oidc.put("authority", oidcAuthority.orElse(""));
            oidc.put("clientId", oidcClientId.orElse(""));
            oidc.put("scopes", oidcScopes.orElse("openid profile email").split(" "));
            oidc.put("redirectUri", "/");
        }
        response.put("oidc", oidc);

        response.put("databaseMode", databaseMode);

        return Response.ok(response).build();
    }
}
