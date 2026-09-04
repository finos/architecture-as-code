package org.finos.calm.resources;

import io.quarkus.security.Authenticated;
import io.quarkus.security.PermissionsAllowed;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.finos.calm.domain.NamespaceRequest;
import org.finos.calm.domain.UpdateNamespaceRequest;
import org.finos.calm.domain.ValueWrapper;
import org.finos.calm.domain.audit.AuditAction;
import org.finos.calm.domain.audit.AuditEntityType;
import org.finos.calm.domain.exception.NamespaceAlreadyExistsException;
import org.finos.calm.domain.exception.NamespaceNotEmptyException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.NamespaceParentNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceCounts;
import org.finos.calm.domain.namespaces.NamespaceInfo;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.security.AuditRequestFilter;
import org.finos.calm.security.CalmHubPermissionChecker;
import org.finos.calm.security.CalmHubScopes;
import org.finos.calm.security.UserAccessValidator;
import org.finos.calm.services.CountsService;
import org.finos.calm.services.NamespaceService;
import org.finos.calm.store.UserAccessStore;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import static org.finos.calm.resources.CalmResourceErrorResponses.invalidNamespaceResponse;
import static org.finos.calm.resources.CalmResourceErrorResponses.namespaceNotEmptyResponse;
import static org.finos.calm.resources.ResourceValidationConstants.NAMESPACE_MESSAGE;
import static org.finos.calm.resources.ResourceValidationConstants.NAMESPACE_REGEX;

@Tag(name = "Storage API", description = "Numeric-ID based CALM storage endpoints")
@Path("/api/calm/namespaces")
public class NamespaceResource {

    private final NamespaceService namespaceService;
    private final CountsService countsService;
    private final Instance<UserAccessValidator> userAccessValidatorInstance;

    @Inject
    SecurityIdentity identity;

    @Inject
    CalmHubPermissionChecker permissionChecker;

    @Inject
    UserAccessStore userAccessStore;

    @Inject
    @ConfigProperty(name = "calm.auth.enabled", defaultValue = "false")
    boolean authEnabled;

    @Inject
    public NamespaceResource(NamespaceService namespaceService,
                             CountsService countsService,
                             Instance<UserAccessValidator> userAccessValidatorInstance) {
        this.namespaceService = namespaceService;
        this.countsService = countsService;
        this.userAccessValidatorInstance = userAccessValidatorInstance;
    }

    @GET
    @Operation(
            summary = "Available Namespaces",
            description = "The available namespaces available in this Calm Hub"
    )
    @Authenticated
    public ValueWrapper<NamespaceInfo> namespaces() {
        Optional<Set<String>> readable = resolveReadableNamespaces();
        if (readable.isEmpty()) {
            return new ValueWrapper<>(namespaceService.getNamespaces());
        }
        return new ValueWrapper<>(namespaceService.getNamespaces().stream()
                .filter(ns -> readable.get().contains(ns.getName()))
                .toList());
    }

    @GET
    @Path("counts")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Namespace Resource Counts",
            description = "Per-namespace counts of each resource type plus a total, for the browse rail and namespace page"
    )
    // @Authenticated (not per-namespace @PermissionsAllowed) because @PermissionsAllowed
    // cannot target a specific namespace for an endpoint that returns all of them. The
    // per-namespace READ filter is applied inside, mirroring SearchResource: a caller only
    // sees counts for namespaces they can READ, while global-admin / no-auth / public-read
    // (Optional.empty) see everything.
    @Authenticated
    public ValueWrapper<NamespaceCounts> namespaceCounts() {
        return new ValueWrapper<>(countsService.getNamespaceCounts(resolveReadableNamespaces()));
    }

    private Optional<Set<String>> resolveReadableNamespaces() {
        if (!authEnabled) {
            return Optional.empty();
        }
        if (userAccessValidatorInstance.isResolvable()) {
            return ReadableScope.resolve(authEnabled, userAccessValidatorInstance, identity,
                    UserAccessValidator::getReadableNamespaces);
        }
        // Fallback: derive readable set from UserAccessStore grants (GitHub/OIDC mode)
        if (identity.isAnonymous() || identity.getPrincipal() == null || userAccessStore == null) {
            return Optional.empty();
        }
        String username = identity.getPrincipal().getName();
        Set<String> readable = userAccessStore.getGrantsForUser(username).stream()
                .map(UserAccess::getNamespace)
                .filter(ns -> ns != null)
                .collect(Collectors.toSet());
        return Optional.of(readable);
    }

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Create Namespace",
            description = "Create a new namespace in the Calm Hub"
    )
    // @Authenticated + manual check rather than @PermissionsAllowed because the namespace name
    // is in the request body (not a path param), so Quarkus Security cannot bind it declaratively.
    @Authenticated
    public Response createNamespace(@Valid @NotNull(message = "Request must not be null") NamespaceRequest request) throws URISyntaxException {

        String name = request.getName().trim();
        String description = request.getDescription().trim();

        if (CalmHubPermissionChecker.GLOBAL_ACCESS.equalsIgnoreCase(name)) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("{\"error\":\"'GLOBAL' is a reserved namespace name\"}")
                    .build();
        }

        // Staged before the manual permission check below (not @PermissionsAllowed-guarded,
        // since the namespace name lives in the body) so AuditRequestFilter can record a
        // fully-identified DENIED entry, not just an anonymous 403.
        AuditRequestFilter.stage(new AuditRequestFilter.AuditContext(
                AuditEntityType.NAMESPACE, AuditAction.CREATE, name, null, null, null));

        boolean isGlobalAdmin = permissionChecker.hasGlobalAdmin(identity);
        boolean isChildNamespace = name.contains(".");
        boolean isParentAdmin = isChildNamespace
                && permissionChecker.allowNamespaceAdmin(identity, name.substring(0, name.lastIndexOf('.')));

        if (!isGlobalAdmin && !isParentAdmin) {
            return Response.status(Response.Status.FORBIDDEN)
                    .entity("{\"error\":\"Insufficient permissions to create namespace\"}")
                    .build();
        }

        try {
            namespaceService.createNamespace(name, description);
        } catch (NamespaceParentNotFoundException e) {
            return Response.status(422)
                    .entity("{\"error\":\"" + e.getMessage() + "\"}")
                    .build();
        } catch (NamespaceAlreadyExistsException e) {
            return Response.status(Response.Status.CONFLICT)
                    .entity("{\"error\":\"Namespace already exists\"}")
                    .build();
        }

        return Response.created(new URI("/api/calm/namespaces/" + name)).build();
    }

    @PUT
    @Path("{namespace}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Update Namespace Description",
            description = "Updates the description of an existing namespace"
    )
    @PermissionsAllowed(CalmHubScopes.ADMIN)
    public Response updateNamespace(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @Valid @NotNull(message = "Request must not be null") UpdateNamespaceRequest request) {
        try {
            namespaceService.updateNamespaceDescription(namespace, request.getDescription().trim());
        } catch (NamespaceNotFoundException e) {
            return invalidNamespaceResponse(namespace);
        }
        return Response.noContent().build();
    }

    @DELETE
    @Path("{namespace}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Delete Namespace",
            description = "Deletes a namespace, provided it has no content and no child namespaces. Also removes all user-access grants for the namespace."
    )
    @PermissionsAllowed(CalmHubScopes.ADMIN)
    public Response deleteNamespace(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace) {
        try {
            namespaceService.deleteNamespace(namespace);
        } catch (NamespaceNotFoundException e) {
            return invalidNamespaceResponse(namespace);
        } catch (NamespaceNotEmptyException e) {
            return namespaceNotEmptyResponse(e.getNamespace(), e.getChildNamespaceCount());
        }
        return Response.noContent().build();
    }

}