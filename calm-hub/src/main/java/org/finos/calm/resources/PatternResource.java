package org.finos.calm.resources;

import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.bson.json.JsonParseException;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.finos.calm.domain.*;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.PatternNotFoundException;
import org.finos.calm.domain.exception.PatternVersionExistsException;
import org.finos.calm.domain.exception.PatternVersionNotFoundException;
import org.finos.calm.domain.patterns.CreatePatternRequest;
import org.finos.calm.security.CalmHubScopes;
import org.finos.calm.security.PermittedScopes;
import org.finos.calm.store.PatternStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.URISyntaxException;

import static org.finos.calm.resources.ResourceValidationConstants.NAMESPACE_MESSAGE;
import static org.finos.calm.resources.ResourceValidationConstants.NAMESPACE_REGEX;
import static org.finos.calm.resources.ResourceValidationConstants.STRICT_SANITIZATION_POLICY;
import static org.finos.calm.resources.ResourceValidationConstants.VERSION_MESSAGE;
import static org.finos.calm.resources.ResourceValidationConstants.VERSION_REGEX;

@Path("/calm/namespaces")
public class PatternResource {

    private final PatternStore store;

    private final Logger logger = LoggerFactory.getLogger(PatternResource.class);

    @ConfigProperty(name = "allow.put.operations", defaultValue = "false")
    Boolean allowPutOperations;

    @Inject
    public PatternResource(PatternStore store) {
        this.store = store;
    }

    @GET
    @Path("{namespace}/patterns")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Retrieve patterns in a given namespace",
            description = "Patterns stored in a given namespace"
    )
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL, CalmHubScopes.ARCHITECTURES_READ})
    public Response getPatternsForNamespace(
            @PathParam("namespace") @jakarta.validation.constraints.Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace
    ) {
        try {
            return Response.ok(new ValueWrapper<>(store.getPatternsForNamespace(namespace))).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when retrieving patterns", namespace, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        }
    }

    @POST
    @Path("{namespace}/patterns")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Create pattern for namespace",
            description = "Creates a pattern for a given namespace with an allocated ID and version 1.0.0"
    )
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL})
    public Response createPatternForNamespace(
            @PathParam("namespace") @jakarta.validation.constraints.Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            CreatePatternRequest pattern
    ) throws URISyntaxException {
        try {
            Pattern createdPattern = patternStore.createPatternForNamespace(pattern, namespace)
            return patternWithLocationResponse(createdPattern);
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when creating pattern", namespace, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (JsonParseException e) {
            logger.error("Cannot parse Pattern JSON for namespace [{}]. Pattern JSON : [{}]", namespace, STRICT_SANITIZATION_POLICY.sanitize(patternJson), e);
            return invalidPatternJsonResponse(STRICT_SANITIZATION_POLICY.sanitize(pattern.getPatternJson()));
        }
    }

    @GET
    @Path("{namespace}/patterns/{patternId}/versions")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Retrieve a list of versions for a given pattern",
            description = "Pattern versions are not opinionated, outside of the first version created"
    )
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL, CalmHubScopes.ARCHITECTURES_READ})
    public Response getPatternVersions(
            @PathParam("namespace") @jakarta.validation.constraints.Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("patternId") int patternId
    ) {
        try {
            return Response.ok(new ValueWrapper<>(patternStore.getPatternVersions(namespace, patternId))).build();
        } catch (NamespaceNotFoundException e) {

            logger.error("Invalid namespace [{}] when getting versions of pattern", namespace, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (PatternNotFoundException e) {
            logger.error("Invalid pattern [{}] when getting versions of pattern", patternId, e);
            return invalidPatternResponse(patternId);
        }
    }

    @GET
    @Path("{namespace}/patterns/{patternId}/versions/{version}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Retrieve a specific pattern at a given version",
            description = "Retrieve patterns at a specific version"
    )
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL, CalmHubScopes.ARCHITECTURES_READ})
    public Response getPattern(
            @PathParam("namespace") @jakarta.validation.constraints.Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("patternId") int patternId,
            @PathParam("version") @jakarta.validation.constraints.Pattern(regexp = VERSION_REGEX, message = VERSION_MESSAGE) String version
    ) {
        try {
            return Response.ok(patternStore.getPatternForVersion(namespace, patternId, version)).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when getting a pattern", namespace, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (PatternNotFoundException e) {
            logger.error("Invalid pattern [{}] when getting a pattern", patternId, e);
            return invalidPatternResponse(patternId);
        } catch (PatternVersionNotFoundException e) {
            logger.error("Invalid version [{}] when getting a pattern", version, e);
            return invalidVersionResponse(version);
        }
    }

    @POST
    @Path("{namespace}/patterns/{patternId}/versions/{version}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL})
    public Response createPatternForVersion(
            @PathParam("namespace") @jakarta.validation.constraints.Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("patternId") int patternId,
            @PathParam("version") @jakarta.validation.constraints.Pattern(regexp = VERSION_REGEX, message = VERSION_MESSAGE) String version,
            CreatePatternRequest createPatternRequest
    ) throws URISyntaxException {
        try {
            createdPattern = patternStore.createPatternForVersion(createPatternRequest, namespace, patternId, version);
            return patternWithLocationResponse(createdPattern);
        } catch (PatternVersionExistsException e) {
            logger.error("Pattern version already exists [{}] when trying to create new pattern", createdPattern, e);
            return Response.status(Response.Status.CONFLICT).entity("Version already exists: " + version).build();
        } catch (PatternNotFoundException e) {
            logger.error("Invalid pattern [{}] when getting a pattern", createdPattern, e);
            return invalidPatternResponse(patternId);
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when getting a pattern", createdPattern, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        }
    }

    @PUT
    @Path("{namespace}/patterns/{patternId}/versions/{version}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Updates a Pattern (if available)",
            description = "In mutable version stores pattern updates are supported by this endpoint, operation unavailable returned in repositories without configuration specified"
    )
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL})
    public Response updateVersionedPattern(
            @PathParam("namespace") @jakarta.validation.constraints.Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("patternId") int patternId,
            @PathParam("version") @jakarta.validation.constraints.Pattern(regexp = VERSION_REGEX, message = VERSION_MESSAGE) String version,
            CreatePatternRequest createPatternRequest
    ) throws URISyntaxException {
        if (!allowPutOperations) {
            return Response.status(Response.Status.FORBIDDEN).entity("This Calm Hub does not support PUT operations").build();
        }

        try {
            updatedPattern = patternStore.updatePatternForVersion(createPatternRequest, namespace, patternId, version);
            return patternWithLocationResponse(updatedPattern);
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when trying to put pattern", updatedPattern, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (PatternNotFoundException e) {
            logger.error("Invalid pattern [{}] when trying to put pattern", updatedPattern, e);
            return invalidPatternResponse(patternId);
        }


    }

    private Response patternWithLocationResponse(String namespace, CreatePatternRequest pattern) throws URISyntaxException {
        return Response.created(new URI("/calm/namespaces/" + namespace + "/patterns/" + pattern.getId() + "/versions/" + pattern.getVersion())).build();
    }
    private Response invalidPatternJsonResponse(String patternJson) {
        return Response.status(Response.Status.BAD_REQUEST).entity("The pattern JSON could not be parsed: " + patternJson).build();
    }

    private Response invalidPatternResponse(int patternId) {
        return Response.status(Response.Status.NOT_FOUND).entity("Invalid pattern provided: " + patternId).build();
    }

    private Response invalidVersionResponse(String version) {
        return Response.status(Response.Status.NOT_FOUND).entity("Invalid version provided: " + version).build();
    }
}
