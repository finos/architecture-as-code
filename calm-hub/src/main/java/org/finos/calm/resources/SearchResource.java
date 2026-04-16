package org.finos.calm.resources;

import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.finos.calm.domain.search.GroupedSearchResults;
import org.finos.calm.security.CalmHubScopes;
import org.finos.calm.security.PermittedScopes;
import org.finos.calm.store.SearchStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Path("/calm/search")
public class SearchResource {

    private static final int MAX_QUERY_LENGTH = 200;

    private final Logger log = LoggerFactory.getLogger(getClass());
    private final SearchStore searchStore;

    @Inject
    public SearchResource(SearchStore searchStore) {
        this.searchStore = searchStore;
    }

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Global Search",
            description = "Search across all resource types (architectures, patterns, flows, standards, interfaces, controls, ADRs) with results grouped by type"
    )
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL, CalmHubScopes.ARCHITECTURES_READ,
            CalmHubScopes.ADRS_ALL, CalmHubScopes.ADRS_READ})
    public Response search(@QueryParam("q") String query) {
        if (query == null || query.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("{\"error\":\"Query parameter 'q' is required\"}")
                    .build();
        }

        if (query.length() > MAX_QUERY_LENGTH) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("{\"error\":\"Query parameter 'q' must not exceed " + MAX_QUERY_LENGTH + " characters\"}")
                    .build();
        }

        try {
            GroupedSearchResults results = searchStore.search(query);
            return Response.ok(results).build();
        } catch (Exception e) {
            log.error("Error performing search for query: {}", query, e);
            return Response.serverError()
                    .entity("{\"error\":\"An unexpected error occurred while performing the search\"}")
                    .build();
        }
    }
}
