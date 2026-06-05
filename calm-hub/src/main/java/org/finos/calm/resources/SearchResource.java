package org.finos.calm.resources;

import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.finos.calm.domain.search.GroupedSearchResults;
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

    @Inject
    SecurityIdentity identity;

    @Inject
    @ConfigProperty(name = "calm.auth.enabled", defaultValue = "false")
    boolean authEnabled;

    @Inject
    public SearchResource(SearchStore searchStore,
                          Instance<UserAccessValidator> userAccessValidatorInstance) {
        this.searchStore = searchStore;
        this.userAccessValidatorInstance = userAccessValidatorInstance;
    }

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Global Search",
            description = "Search across all resource types (architectures, patterns, flows, standards, interfaces, controls, ADRs) with results grouped by type"
    )
    @Authenticated
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

    private Optional<Set<String>> resolveReadableNamespaces() {
        if (!authEnabled || !userAccessValidatorInstance.isResolvable()) {
            return Optional.empty();
        }
        return Optional.of(userAccessValidatorInstance.get().getReadableNamespaces(identity.getPrincipal().getName()));
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
