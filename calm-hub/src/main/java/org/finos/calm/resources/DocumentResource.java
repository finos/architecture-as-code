package org.finos.calm.resources;

import static org.finos.calm.resources.ResourceValidationConstants.NAMESPACE_MESSAGE;
import static org.finos.calm.resources.ResourceValidationConstants.NAMESPACE_REGEX;
import static org.finos.calm.resources.ResourceValidationConstants.NARRATIVE_DOCUMENT_TYPES;
import static org.finos.calm.resources.ResourceValidationConstants.STRICT_SANITIZATION_POLICY;
import static org.finos.calm.resources.ResourceValidationConstants.VERSION_MESSAGE;
import static org.finos.calm.resources.ResourceValidationConstants.VERSION_REGEX;

import io.quarkus.security.PermissionsAllowed;

import jakarta.validation.constraints.Pattern;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.finos.calm.domain.Document;
import org.finos.calm.domain.ValueWrapper;
import org.finos.calm.domain.documents.CreateDocumentRequest;
import org.finos.calm.domain.documents.DocumentVersionResponse;
import org.finos.calm.domain.exception.DocumentNotFoundException;
import org.finos.calm.domain.exception.DocumentVersionExistsException;
import org.finos.calm.domain.exception.DocumentVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.security.CalmHubScopes;
import org.finos.calm.services.DocumentService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.yaml.snakeyaml.Yaml;

import java.net.URI;
import java.util.Map;
import java.util.regex.Matcher;

@Tag(name = "Storage API", description = "Numeric-ID based CALM storage endpoints")
@Path("/api/calm/namespaces")
@Consumes(MediaType.APPLICATION_JSON)
public class DocumentResource {

    private static final java.util.regex.Pattern FRONTMATTER_PATTERN =
            java.util.regex.Pattern.compile(
                    "\\A---\\r?\\n(.*?)\\r?\\n---(?=\\r?\\n|\\z)", java.util.regex.Pattern.DOTALL);
    private static final Logger LOGGER = LoggerFactory.getLogger(DocumentResource.class);

    private final DocumentService documentService;

    public DocumentResource(DocumentService documentService) {
        this.documentService = documentService;
    }

    @GET
    @Path("{namespace}/documents/{documentType}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "List documents for a namespace and narrative type",
            description =
                    "Returns all documents stored for the supplied namespace and narrative document"
                            + " type.")
    @APIResponse(responseCode = "200", description = "Documents returned")
    @PermissionsAllowed(CalmHubScopes.READ)
    public Response list(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE)
                    String namespace,
            @PathParam("documentType") String type) {
        if (!NARRATIVE_DOCUMENT_TYPES.contains(type)) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("Unsupported document type")
                    .build();
        }
        try {
            return Response.ok(
                            new ValueWrapper<>(
                                    documentService.getDocumentsForNamespace(namespace, type)))
                    .build();
        } catch (NamespaceNotFoundException e) {
            LOGGER.error(
                    "Namespace [{}] was not found while listing documents",
                    STRICT_SANITIZATION_POLICY.sanitize(namespace),
                    e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        }
    }

    @POST
    @Path("{namespace}/documents/{documentType}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Create a narrative document",
            description = "Creates a narrative document at immutable version 1.0.0.")
    @APIResponse(responseCode = "201", description = "Document created")
    @PermissionsAllowed(CalmHubScopes.WRITE)
    public Response create(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE)
                    String namespace,
            @PathParam("documentType") String type,
            CreateDocumentRequest request) {
        Response invalidResponse = validate(type, request);
        if (invalidResponse != null) {
            return invalidResponse;
        }
        try {
            Document document =
                    documentService.createDocumentForNamespace(request, namespace, type);
            return Response.created(
                            URI.create(
                                    "/api/calm/namespaces/"
                                            + namespace
                                            + "/documents/"
                                            + type
                                            + "/"
                                            + document.getId()
                                            + "/versions/1.0.0"))
                    .build();
        } catch (NamespaceNotFoundException e) {
            LOGGER.error(
                    "Namespace [{}] was not found while creating a document",
                    STRICT_SANITIZATION_POLICY.sanitize(namespace),
                    e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        }
    }

    @GET
    @Path("{namespace}/documents/{documentType}/{id}/versions")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "List narrative document versions",
            description = "Returns the immutable versions for a narrative document.")
    @APIResponse(responseCode = "200", description = "Versions returned")
    @PermissionsAllowed(CalmHubScopes.READ)
    public Response versions(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE)
                    String namespace,
            @PathParam("documentType") String type,
            @PathParam("id") Integer id) {
        if (!NARRATIVE_DOCUMENT_TYPES.contains(type)) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("Unsupported document type")
                    .build();
        }
        try {
            return Response.ok(
                            new ValueWrapper<>(
                                    documentService.getDocumentVersions(namespace, type, id)))
                    .build();
        } catch (NamespaceNotFoundException e) {
            LOGGER.error(
                    "Namespace [{}] was not found while listing document versions",
                    STRICT_SANITIZATION_POLICY.sanitize(namespace),
                    e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (DocumentNotFoundException e) {
            LOGGER.error("Document [{}] was not found while listing versions", id, e);
            return notFound();
        }
    }

    @GET
    @Path("{namespace}/documents/{documentType}/{id}/versions/{version}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Get a narrative document version",
            description =
                    "Returns the Markdown content for one immutable narrative document version.")
    @APIResponse(responseCode = "200", description = "Document Markdown returned")
    @PermissionsAllowed(CalmHubScopes.READ)
    public Response get(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE)
                    String namespace,
            @PathParam("documentType") String type,
            @PathParam("id") Integer id,
            @PathParam("version") @Pattern(regexp = VERSION_REGEX, message = VERSION_MESSAGE)
                    String version) {
        if (!NARRATIVE_DOCUMENT_TYPES.contains(type)) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("Unsupported document type")
                    .build();
        }
        try {
            return Response.ok(
                            new DocumentVersionResponse(
                                    documentService.getDocumentForVersion(
                                            namespace, type, id, version)))
                    .build();
        } catch (NamespaceNotFoundException e) {
            LOGGER.error(
                    "Namespace [{}] was not found while getting a document version",
                    STRICT_SANITIZATION_POLICY.sanitize(namespace),
                    e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (DocumentNotFoundException | DocumentVersionNotFoundException e) {
            LOGGER.error(
                    "Document [{}] or version [{}] was not found",
                    id,
                    STRICT_SANITIZATION_POLICY.sanitize(version),
                    e);
            return notFound();
        }
    }

    @POST
    @Path("{namespace}/documents/{documentType}/{id}/versions/{version}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Create a narrative document version",
            description = "Creates an immutable version for an existing narrative document.")
    @APIResponse(responseCode = "201", description = "Document version created")
    @PermissionsAllowed(CalmHubScopes.WRITE)
    public Response createVersion(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE)
                    String namespace,
            @PathParam("documentType") String type,
            @PathParam("id") Integer id,
            @PathParam("version") @Pattern(regexp = VERSION_REGEX, message = VERSION_MESSAGE)
                    String version,
            CreateDocumentRequest request) {
        Response invalidResponse = validate(type, request);
        if (invalidResponse != null) {
            return invalidResponse;
        }
        try {
            documentService.createDocumentForVersion(request, namespace, type, id, version);
            return Response.created(
                            URI.create(
                                    "/api/calm/namespaces/"
                                            + namespace
                                            + "/documents/"
                                            + type
                                            + "/"
                                            + id
                                            + "/versions/"
                                            + version))
                    .build();
        } catch (NamespaceNotFoundException e) {
            LOGGER.error(
                    "Namespace [{}] was not found while creating a document version",
                    STRICT_SANITIZATION_POLICY.sanitize(namespace),
                    e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (DocumentNotFoundException e) {
            LOGGER.error("Document [{}] was not found while creating a document version", id, e);
            return notFound();
        } catch (DocumentVersionExistsException e) {
            LOGGER.error(
                    "Document version [{}] already exists",
                    STRICT_SANITIZATION_POLICY.sanitize(version),
                    e);
            return Response.status(Response.Status.CONFLICT)
                    .entity("Document version already exists")
                    .build();
        }
    }

    private Response validate(String type, CreateDocumentRequest request) {
        if (!NARRATIVE_DOCUMENT_TYPES.contains(type)) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("Unsupported document type")
                    .build();
        }
        if (request == null || !hasMappingFrontmatter(request.getDocumentMarkdown())) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("documentMarkdown must begin with YAML mapping frontmatter")
                    .build();
        }
        return null;
    }

    private boolean hasMappingFrontmatter(String markdown) {
        if (markdown == null) {
            return false;
        }
        Matcher frontmatter = FRONTMATTER_PATTERN.matcher(markdown);
        if (!frontmatter.find()) {
            return false;
        }
        try {
            Object parsed = new Yaml().load(frontmatter.group(1));
            return parsed instanceof Map<?, ?> mapping && !mapping.isEmpty();
        } catch (RuntimeException e) {
            LOGGER.warn("Document frontmatter could not be parsed", e);
            return false;
        }
    }

    private Response notFound() {
        return Response.status(Response.Status.NOT_FOUND).entity("Document not found").build();
    }
}
