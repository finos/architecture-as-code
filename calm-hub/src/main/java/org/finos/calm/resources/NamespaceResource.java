package org.finos.calm.resources;

import io.quarkus.security.Authenticated;
import io.quarkus.security.PermissionsAllowed;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.finos.calm.domain.NamespaceRequest;
import org.finos.calm.domain.ValueWrapper;
import org.finos.calm.domain.exception.NamespaceAlreadyExistsException;
import org.finos.calm.domain.namespaces.NamespaceInfo;
import org.finos.calm.security.CalmHubPermissionChecker;
import org.finos.calm.security.CalmHubScopes;
import org.finos.calm.store.NamespaceStore;

import java.net.URI;
import java.net.URISyntaxException;

@Tag(name = "Storage API", description = "Numeric-ID based CALM storage endpoints")
@Path("/api/calm/namespaces")
public class NamespaceResource {

    private final NamespaceStore namespaceStore;

    @Inject
    public NamespaceResource(NamespaceStore store) {
        this.namespaceStore = store;
    }

    @GET
    @Operation(
            summary = "Available Namespaces",
            description = "The available namespaces available in this Calm Hub"
    )
    @Authenticated
    public ValueWrapper<NamespaceInfo> namespaces() {
        return new ValueWrapper<>(namespaceStore.getNamespaces());
    }

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Create Namespace",
            description = "Create a new namespace in the Calm Hub"
    )
    @PermissionsAllowed(CalmHubScopes.GLOBAL_ADMIN)
    public Response createNamespace(@Valid @NotNull(message = "Request must not be null") NamespaceRequest request) throws URISyntaxException {

        String name = request.getName().trim();
        String description = request.getDescription().trim();

        if (CalmHubPermissionChecker.GLOBAL_ACCESS.equalsIgnoreCase(name)) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("{\"error\":\"'GLOBAL' is a reserved namespace name\"}")
                    .build();
        }

        try {
            namespaceStore.createNamespace(name, description);
        } catch (NamespaceAlreadyExistsException e) {
            return Response.status(Response.Status.CONFLICT)
                    .entity("{\"error\":\"Namespace already exists\"}")
                    .build();
        }

        return Response.created(new URI("/api/calm/namespaces/" + name)).build();
    }

}