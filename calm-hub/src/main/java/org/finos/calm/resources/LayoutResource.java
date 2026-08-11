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
import org.finos.calm.domain.exception.ArchitectureNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.security.CalmHubScopes;
import org.finos.calm.store.LayoutStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import static org.finos.calm.resources.ResourceValidationConstants.NAMESPACE_MESSAGE;
import static org.finos.calm.resources.ResourceValidationConstants.NAMESPACE_REGEX;

/**
 * Resource for managing the shared, default layout of an architecture in a given namespace.
 *
 * <p>Unlike everything else under {@code .../architectures/{architectureId}}, a layout is not
 * versioned — see {@link LayoutStore}'s class javadoc — so there is exactly one layout per
 * architecture, addressed with no {@code version} path segment. This mirrors the existing
 * non-versioned {@code .../architectures/{architectureId}/timeline} sub-resource already on
 * {@link ArchitectureResource}. Saving is a {@code PUT} rather than a {@code POST} because it
 * is always an idempotent upsert — there is no server-allocated id to report via a
 * {@code Location} header.</p>
 */
@Tag(name = "Storage API", description = "Numeric-ID based CALM storage endpoints")
@Path("/api/calm/namespaces")
@Authenticated
public class LayoutResource {

    private final LayoutStore layoutStore;
    private final Logger logger = LoggerFactory.getLogger(LayoutResource.class);

    @Inject
    public LayoutResource(LayoutStore layoutStore) {
        this.layoutStore = layoutStore;
    }

    /**
     * Retrieve the default layout for an architecture, if one has been saved.
     *
     * @param namespace      the namespace the architecture belongs to
     * @param architectureId the id of the architecture
     * @return the layout, or a 404 if none has been saved
     */
    @GET
    @Path("{namespace}/architectures/{architectureId}/layout")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Retrieve the default layout for an architecture",
            description = "Returns the shared default layout saved for this architecture, if one has been saved. "
                    + "A layout is not version-scoped: it applies across every version of the architecture."
    )
    @PermissionsAllowed(CalmHubScopes.READ)
    public Response getLayout(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("architectureId") @Min(value = 1, message = "Architecture ID must be a positive integer") int architectureId
    ) {
        try {
            return layoutStore.getLayout(namespace, architectureId)
                    .map(layoutJson -> Response.ok(layoutJson).build())
                    .orElseGet(() -> CalmResourceErrorResponses.resourceLayoutNotFoundResponse("architecture", namespace, architectureId));
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when retrieving layout for architecture [{}]", namespace, architectureId, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        }
    }

    /**
     * Save (create or overwrite) the default layout for an architecture.
     *
     * @param namespace      the namespace the architecture belongs to
     * @param architectureId the id of the architecture
     * @param layoutJson     the layout as a raw JSON body — a CALM Hub-internal shape, not a
     *                       validated CALM community schema; see {@link LayoutStore}'s class
     *                       javadoc and ADR 0005
     * @return 204 on success, or an appropriate error response
     */
    @PUT
    @Path("{namespace}/architectures/{architectureId}/layout")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Save the default layout for an architecture",
            description = "Creates or overwrites the shared default layout for this architecture, requiring "
                    + "namespace write access. If the layout body includes a `for` target, it must reference "
                    + "this architecture's canonical path. The architecture must already exist."
    )
    @PermissionsAllowed(CalmHubScopes.WRITE)
    public Response saveLayout(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("architectureId") @Min(value = 1, message = "Architecture ID must be a positive integer") int architectureId,
            String layoutJson
    ) {
        try {
            String forPath = LayoutRequestParsing.parseForTarget(layoutJson);
            String expectedPath = LayoutRequestParsing.canonicalPath(namespace, "architectures", architectureId);
            if (forPath != null && !forPath.equals(expectedPath)) {
                return CalmResourceErrorResponses.invalidLayoutTargetResponse(forPath, expectedPath, "architecture");
            }

            // Checked on the write path only, not on get: a layout with nothing to attach to
            // is a real problem (an orphan that blocks namespace deletion — see
            // NamespaceContentService.hasContent), but a GET for an unknown architecture id
            // already 404s via resourceLayoutNotFoundResponse below, which the UI already
            // treats as "no default saved". No need to pay for a second existence check there.
            // The check itself lives inside LayoutStore#upsertLayout — see that method's
            // javadoc for why it isn't done here via ArchitectureStore#architectureExists.
            layoutStore.upsertLayout(namespace, architectureId, layoutJson);
            return Response.noContent().build();
        } catch (JsonParseException e) {
            logger.error("Cannot parse layout JSON for architecture [{}] in namespace [{}]", architectureId, namespace, e);
            return CalmResourceErrorResponses.invalidJsonResponse("layout");
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when saving layout for architecture [{}]", namespace, architectureId, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (ArchitectureNotFoundException e) {
            logger.warn("No architecture [{}] in namespace [{}] to save a layout against", architectureId, namespace);
            return CalmResourceErrorResponses.resourceNotFoundResponse("architecture", namespace, architectureId);
        }
    }
}
