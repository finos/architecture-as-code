package org.finos.calm.resources;

import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.finos.calm.domain.NamespaceRequest;
import org.finos.calm.domain.ValueWrapper;
import org.finos.calm.security.CalmHubScopes;
import org.finos.calm.security.PermittedScopes;
import org.finos.calm.store.NamespaceStore;

import java.net.URI;
import java.net.URISyntaxException;

@Path("/calm/namespaces")
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
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL,
            CalmHubScopes.ARCHITECTURES_READ, CalmHubScopes.ADRS_ALL, CalmHubScopes.ADRS_READ})
    public ValueWrapper<String> namespaces() {
        return new ValueWrapper<>(namespaceStore.getNamespaces());
    }

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Create Namespace",
            description = "Create a new namespace in the Calm Hub"
    )
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL})
    public Response createNamespace(@Valid @NotNull(message = "Request must not be null") NamespaceRequest request) throws URISyntaxException {

        String namespace = request.getNamespace().trim();

        if (namespaceStore.namespaceExists(namespace)) {
            return Response.status(Response.Status.CONFLICT)
                    .entity("{\"error\":\"Namespace already exists\"}")
                    .build();
        }

        namespaceStore.createNamespace(namespace);
        return Response.created(new URI("/calm/namespaces/" + namespace)).build();
    }

}