package org.finos.calm.resources;

import io.quarkus.security.PermissionsAllowed;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponses;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.finos.calm.domain.ValueWrapper;
import org.finos.calm.domain.conventions.ConventionType;
import org.finos.calm.domain.conventions.CreateConventionRequest;
import org.finos.calm.domain.conventions.SetConventionDefaultRequest;
import org.finos.calm.domain.exception.ConventionNotFoundException;
import org.finos.calm.domain.exception.ConventionSchemaValidationException;
import org.finos.calm.domain.exception.ConventionVersionExistsException;
import org.finos.calm.domain.exception.ConventionVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.security.CalmHubScopes;
import org.finos.calm.services.ConventionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.util.Optional;

import static org.finos.calm.resources.ResourceValidationConstants.NAMESPACE_MESSAGE;
import static org.finos.calm.resources.ResourceValidationConstants.NAMESPACE_REGEX;
import static org.finos.calm.resources.ResourceValidationConstants.STRICT_SANITIZATION_POLICY;
import static org.finos.calm.resources.ResourceValidationConstants.VERSION_MESSAGE;
import static org.finos.calm.resources.ResourceValidationConstants.VERSION_OR_SHA_MESSAGE;
import static org.finos.calm.resources.ResourceValidationConstants.VERSION_OR_SHA_REGEX;
import static org.finos.calm.resources.ResourceValidationConstants.VERSION_REGEX;

/**
 * Versioned conventions that tools read to decide how to process or show CALM documents, one set per convention type, and
 * the default convention that a namespace names for each type. See ADR 0019.
 */
@Tag(name = "Conventions", description = "Versioned tool conventions and namespace defaults")
@Path("/api/calm/namespaces")
public class ConventionResource {

    private static final Logger LOG = LoggerFactory.getLogger(ConventionResource.class);

    private final ConventionService conventionService;

    public ConventionResource(ConventionService conventionService) {
        this.conventionService = conventionService;
    }

    @GET
    @Path("{namespace}/conventions/{conventionType}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "List the conventions of one type in a namespace")
    @APIResponses({
            @APIResponse(responseCode = "200", description = "Conventions returned"),
            @APIResponse(responseCode = "400", description = "Unknown convention type"),
            @APIResponse(responseCode = "404", description = "The namespace does not exist")
    })
    @PermissionsAllowed(CalmHubScopes.READ)
    public Response getConventionsForNamespace(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("conventionType") String conventionType) {
        Optional<ConventionType> type = ConventionType.fromName(conventionType);
        if (type.isEmpty()) {
            return CalmResourceErrorResponses.unknownConventionTypeResponse();
        }
        try {
            return Response.ok(new ValueWrapper<>(conventionService.getConventionsForNamespace(namespace, type.get()))).build();
        } catch (NamespaceNotFoundException e) {
            LOG.error("Invalid namespace [{}] when listing conventions", STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        }
    }

    @POST
    @Path("{namespace}/conventions/{conventionType}")
    @Produces(MediaType.APPLICATION_JSON)
    @Consumes(MediaType.APPLICATION_JSON)
    @Operation(summary = "Create a convention", description = "Creates a convention at immutable version 1.0.0. The convention must match the schema of its type.")
    @APIResponses({
            @APIResponse(responseCode = "201", description = "Convention created"),
            @APIResponse(responseCode = "400", description = "Unknown convention type, or the convention does not match the schema of its type"),
            @APIResponse(responseCode = "404", description = "The namespace does not exist")
    })
    @PermissionsAllowed(CalmHubScopes.WRITE)
    public Response createConvention(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("conventionType") String conventionType,
            CreateConventionRequest request) {
        Optional<ConventionType> type = ConventionType.fromName(conventionType);
        if (type.isEmpty()) {
            return CalmResourceErrorResponses.unknownConventionTypeResponse();
        }
        try {
            int id = conventionService.createConvention(request, namespace, type.get());
            return Response.created(URI.create("/api/calm/namespaces/" + namespace + "/conventions/"
                    + type.get().getName() + "/" + id + "/versions/1.0.0")).build();
        } catch (ConventionSchemaValidationException e) {
            return CalmResourceErrorResponses.conventionSchemaValidationResponse(e);
        } catch (NamespaceNotFoundException e) {
            LOG.error("Invalid namespace [{}] when creating a convention", STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        }
    }

    @GET
    @Path("{namespace}/conventions/{conventionType}/{id}/versions")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "List the versions of a convention")
    @APIResponses({
            @APIResponse(responseCode = "200", description = "Versions returned"),
            @APIResponse(responseCode = "400", description = "Unknown convention type"),
            @APIResponse(responseCode = "404", description = "The namespace or the convention does not exist")
    })
    @PermissionsAllowed(CalmHubScopes.READ)
    public Response getConventionVersions(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("conventionType") String conventionType,
            @PathParam("id") @Min(value = 1, message = "ID must be a positive integer") int id) {
        Optional<ConventionType> type = ConventionType.fromName(conventionType);
        if (type.isEmpty()) {
            return CalmResourceErrorResponses.unknownConventionTypeResponse();
        }
        try {
            return Response.ok(new ValueWrapper<>(conventionService.getConventionVersions(namespace, type.get(), id))).build();
        } catch (NamespaceNotFoundException e) {
            LOG.error("Invalid namespace [{}] when listing convention versions", STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (ConventionNotFoundException e) {
            LOG.error("Convention [{}] not found when listing versions", id, e);
            return CalmResourceErrorResponses.conventionNotFoundResponse(namespace, id);
        }
    }

    @GET
    @Path("{namespace}/conventions/{conventionType}/{id}/versions/{version}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Get a convention version", description = "Returns the JSON of one immutable convention version.")
    @APIResponses({
            @APIResponse(responseCode = "200", description = "Convention JSON returned"),
            @APIResponse(responseCode = "400", description = "Unknown convention type"),
            @APIResponse(responseCode = "404", description = "The namespace, the convention or the version does not exist")
    })
    @PermissionsAllowed(CalmHubScopes.READ)
    public Response getConventionForVersion(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("conventionType") String conventionType,
            @PathParam("id") @Min(value = 1, message = "ID must be a positive integer") int id,
            @PathParam("version") @Pattern(regexp = VERSION_OR_SHA_REGEX, message = VERSION_OR_SHA_MESSAGE) String version) {
        Optional<ConventionType> type = ConventionType.fromName(conventionType);
        if (type.isEmpty()) {
            return CalmResourceErrorResponses.unknownConventionTypeResponse();
        }
        try {
            return Response.ok(conventionService.getConventionForVersion(namespace, type.get(), id, version)).build();
        } catch (NamespaceNotFoundException e) {
            LOG.error("Invalid namespace [{}] when reading a convention", STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (ConventionNotFoundException e) {
            LOG.error("Convention [{}] not found", id, e);
            return CalmResourceErrorResponses.conventionNotFoundResponse(namespace, id);
        } catch (ConventionVersionNotFoundException e) {
            LOG.error("Version [{}] of convention [{}] not found", STRICT_SANITIZATION_POLICY.sanitize(version), id, e);
            return CalmResourceErrorResponses.conventionVersionNotFoundResponse(id, version);
        }
    }

    @POST
    @Path("{namespace}/conventions/{conventionType}/{id}/versions/{version}")
    @Produces(MediaType.APPLICATION_JSON)
    @Consumes(MediaType.APPLICATION_JSON)
    @Operation(summary = "Create a convention version", description = "Adds an immutable version to a convention. The convention must match the schema of its type.")
    @APIResponses({
            @APIResponse(responseCode = "201", description = "Convention version created"),
            @APIResponse(responseCode = "400", description = "Unknown convention type, or the convention does not match the schema of its type"),
            @APIResponse(responseCode = "404", description = "The namespace or the convention does not exist"),
            @APIResponse(responseCode = "409", description = "The version already exists")
    })
    @PermissionsAllowed(CalmHubScopes.WRITE)
    public Response createConventionVersion(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("conventionType") String conventionType,
            @PathParam("id") @Min(value = 1, message = "ID must be a positive integer") int id,
            @PathParam("version") @Pattern(regexp = VERSION_REGEX, message = VERSION_MESSAGE) String version,
            CreateConventionRequest request) {
        Optional<ConventionType> type = ConventionType.fromName(conventionType);
        if (type.isEmpty()) {
            return CalmResourceErrorResponses.unknownConventionTypeResponse();
        }
        try {
            conventionService.createConventionVersion(request, namespace, type.get(), id, version);
            return Response.created(URI.create("/api/calm/namespaces/" + namespace + "/conventions/"
                    + type.get().getName() + "/" + id + "/versions/" + version)).build();
        } catch (ConventionSchemaValidationException e) {
            return CalmResourceErrorResponses.conventionSchemaValidationResponse(e);
        } catch (NamespaceNotFoundException e) {
            LOG.error("Invalid namespace [{}] when creating a convention version", STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (ConventionNotFoundException e) {
            LOG.error("Convention [{}] not found when creating a version", id, e);
            return CalmResourceErrorResponses.conventionNotFoundResponse(namespace, id);
        } catch (ConventionVersionExistsException e) {
            LOG.error("Version [{}] of convention [{}] already exists", STRICT_SANITIZATION_POLICY.sanitize(version), id, e);
            return Response.status(Response.Status.CONFLICT)
                    .entity("Convention version already exists: " + STRICT_SANITIZATION_POLICY.sanitize(version)).build();
        }
    }

    @GET
    @Path("{namespace}/conventions/{conventionType}/default")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Get the default convention that applies to a namespace",
            description = "Returns the default that the namespace sets, else that of its nearest ancestor (org.ab.cd, then org.ab, then org), with its JSON.")
    @APIResponses({
            @APIResponse(responseCode = "200", description = "Default returned. inherited is true when an ancestor sets it"),
            @APIResponse(responseCode = "400", description = "Unknown convention type"),
            @APIResponse(responseCode = "404", description = "The namespace does not exist, or no namespace in its chain sets a default")
    })
    @PermissionsAllowed(CalmHubScopes.READ)
    public Response getDefault(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("conventionType") String conventionType) {
        Optional<ConventionType> type = ConventionType.fromName(conventionType);
        if (type.isEmpty()) {
            return CalmResourceErrorResponses.unknownConventionTypeResponse();
        }
        try {
            return conventionService.resolveDefault(namespace, type.get())
                    .map(resolved -> Response.ok(resolved).build())
                    .orElseGet(() -> CalmResourceErrorResponses.noConventionDefaultResponse(namespace, type.get()));
        } catch (NamespaceNotFoundException e) {
            LOG.error("Invalid namespace [{}] when resolving a convention default", STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        }
    }

    @PUT
    @Path("{namespace}/conventions/{conventionType}/default")
    @Produces(MediaType.APPLICATION_JSON)
    @Consumes(MediaType.APPLICATION_JSON)
    @Operation(summary = "Set the default convention of a namespace",
            description = "Names a convention version in this namespace as its default for the type. Child namespaces inherit it. Requires namespace admin.")
    @APIResponses({
            @APIResponse(responseCode = "200", description = "Default set"),
            @APIResponse(responseCode = "400", description = "Unknown convention type, or no conventionId or version"),
            @APIResponse(responseCode = "404", description = "The namespace, the convention or the version does not exist")
    })
    @PermissionsAllowed(CalmHubScopes.ADMIN)
    public Response setDefault(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("conventionType") String conventionType,
            SetConventionDefaultRequest request) {
        Optional<ConventionType> type = ConventionType.fromName(conventionType);
        if (type.isEmpty()) {
            return CalmResourceErrorResponses.unknownConventionTypeResponse();
        }
        if (request == null || request.conventionId() == null || request.version() == null
                || !request.version().matches(VERSION_OR_SHA_REGEX)) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("The body must have a conventionId and a version (semver or a hex SHA)").build();
        }
        try {
            return Response.ok(conventionService.setDefault(namespace, type.get(), request.conventionId(), request.version())).build();
        } catch (NamespaceNotFoundException e) {
            LOG.error("Invalid namespace [{}] when setting a convention default", STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (ConventionNotFoundException e) {
            LOG.error("Convention [{}] not found when setting a default", request.conventionId(), e);
            return CalmResourceErrorResponses.conventionNotFoundResponse(namespace, request.conventionId());
        } catch (ConventionVersionNotFoundException e) {
            LOG.error("Version of convention [{}] not found when setting a default", request.conventionId(), e);
            return CalmResourceErrorResponses.conventionVersionNotFoundResponse(request.conventionId(), request.version());
        }
    }

    @DELETE
    @Path("{namespace}/conventions/{conventionType}/default")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Remove the default convention of a namespace",
            description = "The namespace then inherits the default of its nearest ancestor. Requires namespace admin.")
    @APIResponses({
            @APIResponse(responseCode = "204", description = "Default removed"),
            @APIResponse(responseCode = "400", description = "Unknown convention type"),
            @APIResponse(responseCode = "404", description = "The namespace does not exist, or it sets no default")
    })
    @PermissionsAllowed(CalmHubScopes.ADMIN)
    public Response deleteDefault(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("conventionType") String conventionType) {
        Optional<ConventionType> type = ConventionType.fromName(conventionType);
        if (type.isEmpty()) {
            return CalmResourceErrorResponses.unknownConventionTypeResponse();
        }
        try {
            return conventionService.deleteDefault(namespace, type.get())
                    ? Response.noContent().build()
                    : CalmResourceErrorResponses.noConventionDefaultResponse(namespace, type.get());
        } catch (NamespaceNotFoundException e) {
            LOG.error("Invalid namespace [{}] when removing a convention default", STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        }
    }
}
