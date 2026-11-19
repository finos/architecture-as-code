package org.finos.calm.resources;

import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.finos.calm.extensions.ExtensionProxyException;
import org.finos.calm.extensions.ExtensionSearch;

import java.util.Map;

/** One page of results from an extension search provider. The rules are in {@link ExtensionSearch}. */
@Tag(name = "Extensions", description = "Extensions that the operator enabled on this CALM Hub")
@Path("/api/calm/extensions/{id}/search/{provider}")
@Authenticated
public class ExtensionSearchResource {

    private final ExtensionSearch search;
    private final SecurityIdentity identity;

    @Inject
    public ExtensionSearchResource(ExtensionSearch search, SecurityIdentity identity) {
        this.search = search;
        this.identity = identity;
    }

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Search with an extension search provider",
            description = "Sends the query to the provider route with a CALM Hub identity assertion, and returns one page "
                    + "of results. CALM Hub leaves out each result that is not valid or that names a namespace the caller "
                    + "cannot read. Give the next value of a page as cursor to get the page after it.")
    public Response search(@PathParam("id") String id, @PathParam("provider") String provider,
                           @QueryParam("q") String query, @QueryParam("cursor") String cursor) {
        try {
            return Response.ok(search.search(identity, id, provider, query, cursor).toString())
                    .header("Cache-Control", "private, no-store")
                    .build();
        } catch (ExtensionProxyException e) {
            Response.ResponseBuilder builder = Response.status(e.status());
            e.headers().forEach(builder::header);
            return builder.type(MediaType.APPLICATION_JSON)
                    .entity(Map.of("error", e.getMessage()))
                    .header("Cache-Control", "private, no-store")
                    .build();
        }
    }
}
