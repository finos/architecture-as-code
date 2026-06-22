package org.finos.calm.resources;

import java.util.List;
import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.store.UserAccessStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import static org.finos.calm.security.CalmHubPermissionChecker.GLOBAL_ACCESS;

@Tag(name = "Storage API", description = "Numeric-ID based CALM storage endpoints")
@Path("/api/calm/user-access")
public class CurrentUserAccessResource {

    private final UserAccessStore store;
    private final Logger logger = LoggerFactory.getLogger(CurrentUserAccessResource.class);

    @Inject
    SecurityIdentity identity;

    @Inject
    @ConfigProperty(name = "calm.auth.enabled", defaultValue = "false")
    boolean authEnabled;

    public CurrentUserAccessResource(UserAccessStore store) {
        this.store = store;
    }

    @GET
    @Path("current")
    @Produces(MediaType.APPLICATION_JSON)
    @Authenticated
    @Operation(
            summary = "Get grants for the authenticated user",
            description = "Returns all user-access grants for the calling user, including wildcard grants that grant implicit access. Used by UIs to determine which namespaces the user can access."
    )
    public Response getCurrentUserAccess() {
        String username = identity.getPrincipal().getName();
        if (!authEnabled) {
            logger.debug("Auth disabled — returning synthetic GLOBAL admin grant for user [{}]", username);
            UserAccess syntheticGrant = new UserAccess.UserAccessBuilder()
                    .setUsername(username)
                    .setPermission(UserAccess.Permission.admin)
                    .setNamespace(GLOBAL_ACCESS)
                    .build();
            return Response.ok(List.of(syntheticGrant)).build();
        }
        logger.debug("Fetching grants for user [{}]", username);
        List<UserAccess> grants = store.getGrantsForUser(username);
        return Response.ok(grants).build();
    }
}
