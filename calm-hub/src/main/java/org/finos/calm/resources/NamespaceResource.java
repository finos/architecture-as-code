package org.finos.calm.resources;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.finos.calm.domain.ValueWrapper;
import org.finos.calm.security.ScopesAllowed;
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
    @ScopesAllowed({"architectures:all", "architectures:read"})
    public ValueWrapper<String> namespaces() {
        return new ValueWrapper<>(namespaceStore.getNamespaces());
    }
}