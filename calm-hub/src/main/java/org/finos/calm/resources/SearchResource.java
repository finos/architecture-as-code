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
import org.finos.calm.security.CalmHubScopes;
import org.finos.calm.security.PermittedScopes;
import org.finos.calm.security.UserAccessValidator;
import org.finos.calm.store.SearchStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Optional;
import java.util.Set;

@Path("/calm/search")
public class SearchResource {

    private static final int MAX_QUERY_LENGTH = 200;
    private static final int MAX_LOGGED_QUERY_LENGTH = 100;

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
            description = "Search across all resource types (architectures, patterns, standards, interfaces, controls, ADRs) with results grouped by type"
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
            Optional<Set<String>> readableNamespaces = resolveReadableNamespaces();
            GroupedSearchResults results = searchStore.search(query, readableNamespaces);
            return Response.ok(results).build();
        } catch (Exception e) {
            log.error("Error performing search for query: {}", sanitizeForLog(query), e);
            return Response.serverError()
                    .entity("{\"error\":\"An unexpected error occurred while performing the search\"}")
                    .build();
        }
    }

    /**
     * Returns the set of namespaces the current caller is permitted to read, or
     * {@link Optional#empty()} when no namespace-based filtering should be applied
     * (i.e. the secure profile is not active or the JWT has no username).
     */
    private Optional<Set<String>> resolveReadableNamespaces() {
        if (!userAccessValidatorInstance.isResolvable() || !jwtInstance.isResolvable()) {
            return Optional.empty();
        }
        String username = jwtInstance.get().getClaim("preferred_username");
        if (username == null) {
            return Optional.empty();
        }
        return Optional.of(userAccessValidatorInstance.get().getReadableNamespaces(username));
    }

    /**
     * Strips characters that could be used to forge log entries (CR/LF/other control
     * characters) and truncates the query to a safe maximum length before logging.
     * The query is user-supplied input so must be neutralised before being written
     * to log streams (OWASP A09:2021 — Security Logging Failures).
     */
    static String sanitizeForLog(String value) {
        if (value == null) {
            return "null";
        }
        String truncated = value.length() > MAX_LOGGED_QUERY_LENGTH
                ? value.substring(0, MAX_LOGGED_QUERY_LENGTH) + "..."
                : value;
        return truncated.replaceAll("[\\r\\n\\t\\p{Cntrl}]", "_");
    }
}
