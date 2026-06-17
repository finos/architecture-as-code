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
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.store.UserAccessStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Tag(name = "Storage API", description = "Numeric-ID based CALM storage endpoints")
@Path("/api/calm/user-access")
public class CurrentUserAccessResource {

    private final UserAccessStore store;
    private final Logger logger = LoggerFactory.getLogger(CurrentUserAccessResource.class);

    @Inject
    SecurityIdentity identity;

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
        logger.debug("Fetching grants for user [{}]", username);
        List<UserAccess> grants = store.getGrantsForUser(username);
        return Response.ok(grants).build();
    }
}
