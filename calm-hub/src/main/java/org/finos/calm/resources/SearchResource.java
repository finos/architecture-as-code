package org.finos.calm.resources;

import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.finos.calm.domain.search.GroupedSearchResults;
import org.finos.calm.domain.search.SearchResult;
import org.finos.calm.security.CalmHubScopes;
import org.finos.calm.security.PermittedScopes;
import org.finos.calm.security.UserAccessValidator;
import org.finos.calm.store.SearchStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Set;

@Path("/calm/search")
public class SearchResource {

    private static final int MAX_QUERY_LENGTH = 200;

    private final Logger log = LoggerFactory.getLogger(getClass());
    private final SearchStore searchStore;
    private final Instance<UserAccessValidator> userAccessValidatorInstance;
    private final Instance<JsonWebToken> jwtInstance;

    @Inject
    public SearchResource(SearchStore searchStore,
                          Instance<UserAccessValidator> userAccessValidatorInstance,
                          Instance<JsonWebToken> jwtInstance) {
        this.searchStore = searchStore;
        this.userAccessValidatorInstance = userAccessValidatorInstance;
        this.jwtInstance = jwtInstance;
    }

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Global Search",
            description = "Search across all resource types (architectures, patterns, flows, standards, interfaces, controls, ADRs) with results grouped by type"
    )
    @PermittedScopes({CalmHubScopes.SEARCH_READ})
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

            if (userAccessValidatorInstance.isResolvable() && jwtInstance.isResolvable()) {
                String username = jwtInstance.get().getClaim("preferred_username");
                if (username != null) {
                    Set<String> readableNamespaces = userAccessValidatorInstance.get()
                            .getReadableNamespaces(username);
                    results = filterResultsByAccess(results, readableNamespaces);
                }
            }

            return Response.ok(results).build();
        } catch (Exception e) {
            log.error("Error performing search for query: {}", query, e);
            return Response.serverError()
                    .entity("{\"error\":\"An unexpected error occurred while performing the search\"}")
                    .build();
        }
    }

    private GroupedSearchResults filterResultsByAccess(GroupedSearchResults results,
                                                       Set<String> readableNamespaces) {
        return new GroupedSearchResults(
                filterByNamespace(results.getArchitectures(), readableNamespaces),
                filterByNamespace(results.getPatterns(), readableNamespaces),
                filterByNamespace(results.getFlows(), readableNamespaces),
                filterByNamespace(results.getStandards(), readableNamespaces),
                filterByNamespace(results.getInterfaces(), readableNamespaces),
                filterByNamespace(results.getControls(), readableNamespaces),
                filterByNamespace(results.getAdrs(), readableNamespaces)
        );
    }

    private List<SearchResult> filterByNamespace(List<SearchResult> results,
                                                  Set<String> readableNamespaces) {
        return results.stream()
                .filter(result -> readableNamespaces.contains(result.getNamespace()))
                .toList();
    }
}
