package org.finos.calm.resources;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.finos.calm.domain.ValueWrapper;
import org.finos.calm.security.CalmHubScopes;
import org.finos.calm.security.PermittedScopes;
import org.finos.calm.store.NamespaceStore;

@Path("/calm/namespaces")
public class NamespaceResource {

    private final NamespaceStore namespaceStore;

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
}