package org.finos.calm.resources;

import io.quarkus.security.Authenticated;
import io.quarkus.security.PermissionsAllowed;
import jakarta.inject.Inject;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.bson.json.JsonParseException;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.PatternNotFoundException;
import org.finos.calm.security.CalmHubScopes;
import org.finos.calm.store.PatternLayoutStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import static org.finos.calm.resources.ResourceValidationConstants.NAMESPACE_MESSAGE;
import static org.finos.calm.resources.ResourceValidationConstants.NAMESPACE_REGEX;

/**
 * Resource for managing the shared, default layout of a pattern in a given namespace. A
 * structural twin of {@link LayoutResource}; see {@link PatternLayoutStore}'s class javadoc
 * for why patterns get their own resource/store/collection rather than a
 * {@code resourceType}-discriminated extension of the architecture layout stack.
 *
 * <p>This resource's own reason for existing as a separate class (rather than adding a
 * {@code {namespace}/patterns/{patternId}/layout} path to {@link LayoutResource} itself) is
 * independent of the store-level one: it keeps {@code AuditRequestFilter}'s
 * one-resource-class-to-one-entity-type-to-one-path-param-name mapping simple. A shared
 * resource class serving both {@code architectureId} and {@code patternId} paths would look up
 * the wrong path-param name for one of the two, silently auditing a null entity id.</p>
 *
 * <p>As with architecture layouts, a pattern's layout is not versioned — see
 * {@link PatternLayoutStore}'s class javadoc — so there is exactly one layout per pattern,
 * addressed with no {@code version} path segment. Saving is a {@code PUT} rather than a
 * {@code POST} because it is always an idempotent upsert.</p>
 *
 * <p>The {@code for}-target check below doubles as a cross-type guard: a {@code for} naming
 * the <em>architecture</em> path for the same numeric id (a real possibility, since
 * architecture ids and pattern ids are drawn from independent counters — see
 * {@link PatternLayoutStore}'s class javadoc) does not equal this resource's pattern-canonical
 * path either, so it is rejected by the same equality check as any other mismatched target, with
 * no separate case needed.</p>
 */
@Tag(name = "Storage API", description = "Numeric-ID based CALM storage endpoints")
@Path("/api/calm/namespaces")
@Authenticated
public class PatternLayoutResource {

    private final PatternLayoutStore patternLayoutStore;
    private final Logger logger = LoggerFactory.getLogger(PatternLayoutResource.class);

    @Inject
    public PatternLayoutResource(PatternLayoutStore patternLayoutStore) {
        this.patternLayoutStore = patternLayoutStore;
    }

    /**
     * Retrieve the default layout for a pattern, if one has been saved.
     *
     * @param namespace the namespace the pattern belongs to
     * @param patternId the id of the pattern
     * @return the layout, or a 404 if none has been saved
     */
    @GET
    @Path("{namespace}/patterns/{patternId}/layout")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Retrieve the default layout for a pattern",
            description = "Returns the shared default layout saved for this pattern, if one has been saved. "
                    + "A layout is not version-scoped: it applies across every version of the pattern."
    )
    @PermissionsAllowed(CalmHubScopes.READ)
    public Response getLayout(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("patternId") @Min(value = 1, message = "Pattern ID must be a positive integer") int patternId
    ) {
        try {
            return patternLayoutStore.getLayout(namespace, patternId)
                    .map(layoutJson -> Response.ok(layoutJson).build())
                    .orElseGet(() -> CalmResourceErrorResponses.resourceLayoutNotFoundResponse("pattern", namespace, patternId));
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when retrieving layout for pattern [{}]", namespace, patternId, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        }
    }

    /**
     * Save (create or overwrite) the default layout for a pattern.
     *
     * @param namespace  the namespace the pattern belongs to
     * @param patternId  the id of the pattern
     * @param layoutJson the layout as a raw JSON body — a CALM Hub-internal shape, not a
     *                   validated CALM community schema; see {@link PatternLayoutStore}'s class
     *                   javadoc and ADR 0005
     * @return 204 on success, or an appropriate error response
     */
    @PUT
    @Path("{namespace}/patterns/{patternId}/layout")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Save the default layout for a pattern",
            description = "Creates or overwrites the shared default layout for this pattern, requiring "
                    + "namespace write access. If the layout body includes a `for` target, it must reference "
                    + "this pattern's canonical path. The pattern must already exist."
    )
    @PermissionsAllowed(CalmHubScopes.WRITE)
    public Response saveLayout(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("patternId") @Min(value = 1, message = "Pattern ID must be a positive integer") int patternId,
            String layoutJson
    ) {
        try {
            String forPath = LayoutRequestParsing.parseForTarget(layoutJson);
            String expectedPath = LayoutRequestParsing.canonicalPath(namespace, "patterns", patternId);
            if (forPath != null && !forPath.equals(expectedPath)) {
                return CalmResourceErrorResponses.invalidLayoutTargetResponse(forPath, expectedPath, "pattern");
            }

            // Checked on the write path only, not on get — mirrors LayoutResource#saveLayout.
            // The check itself lives inside PatternLayoutStore#upsertLayout — see that
            // method's javadoc for why it isn't done here via PatternStore#patternExists.
            patternLayoutStore.upsertLayout(namespace, patternId, layoutJson);
            return Response.noContent().build();
        } catch (JsonParseException e) {
            logger.error("Cannot parse layout JSON for pattern [{}] in namespace [{}]", patternId, namespace, e);
            return CalmResourceErrorResponses.invalidJsonResponse("layout");
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when saving layout for pattern [{}]", namespace, patternId, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (PatternNotFoundException e) {
            logger.warn("No pattern [{}] in namespace [{}] to save a layout against", patternId, namespace);
            return CalmResourceErrorResponses.resourceNotFoundResponse("pattern", namespace, patternId);
        }
    }
}
