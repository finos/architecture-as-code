package org.finos.calm.resources;

import io.quarkus.security.PermissionsAllowed;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;
import jakarta.validation.constraints.Pattern;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.finos.calm.domain.Document;
import org.finos.calm.domain.ValueWrapper;
import org.finos.calm.domain.documents.CreateDocumentRequest;
import org.finos.calm.domain.documents.DocumentVersionResponse;
import org.finos.calm.domain.exception.*;
import org.finos.calm.security.CalmHubScopes;
import org.finos.calm.services.DocumentService;
import org.yaml.snakeyaml.Yaml;
import java.net.URI;
import java.util.Map;
import static org.finos.calm.resources.ResourceValidationConstants.*;

@Tag(name = "Storage API", description = "Numeric-ID based CALM storage endpoints")
@Path("/api/calm/namespaces")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class DocumentResource {
    /** Temporary Java-side POC contract pending a published shared contract. */
    private final DocumentService documentService;
    public DocumentResource(DocumentService documentService) { this.documentService = documentService; }
    @GET @Path("{namespace}/documents/{documentType}") @PermissionsAllowed(CalmHubScopes.READ)
    @Operation(summary = "List documents for a namespace and document type") @APIResponse(responseCode = "200", description = "Documents returned")
    public Response list(@PathParam("namespace") @Pattern(regexp=NAMESPACE_REGEX, message=NAMESPACE_MESSAGE) String namespace,
                         @PathParam("documentType") String type) {
        if (!DOCUMENT_TYPES.contains(type)) return Response.status(400).entity("Unsupported document type").build();
        try { return Response.ok(new ValueWrapper<>(documentService.getDocumentsForNamespace(namespace, type))).build(); }
        catch (NamespaceNotFoundException e) { return CalmResourceErrorResponses.invalidNamespaceResponse(namespace); }
    }
    @POST @Path("{namespace}/documents/{documentType}") @PermissionsAllowed(CalmHubScopes.WRITE)
    @Operation(summary = "Create a document at version 1.0.0") @APIResponse(responseCode = "201", description = "Document created")
    public Response create(@PathParam("namespace") @Pattern(regexp=NAMESPACE_REGEX, message=NAMESPACE_MESSAGE) String namespace,
                           @PathParam("documentType") String type, CreateDocumentRequest request) {
        Response invalid = validate(type, request); if (invalid != null) return invalid;
        try { Document doc = documentService.createDocumentForNamespace(request, namespace, type);
            return Response.created(URI.create("/api/calm/namespaces/" + namespace + "/documents/" + type + "/" + doc.getId() + "/versions/1.0.0")).build(); }
        catch (NamespaceNotFoundException e) { return CalmResourceErrorResponses.invalidNamespaceResponse(namespace); }
    }
    @GET @Path("{namespace}/documents/{documentType}/{id}/versions") @PermissionsAllowed(CalmHubScopes.READ)
    @Operation(summary = "List immutable document versions") @APIResponse(responseCode = "200", description = "Versions returned")
    public Response versions(@PathParam("namespace") @Pattern(regexp=NAMESPACE_REGEX, message=NAMESPACE_MESSAGE) String namespace, @PathParam("documentType") String type, @PathParam("id") Integer id) {
        if (!DOCUMENT_TYPES.contains(type)) return Response.status(400).entity("Unsupported document type").build();
        try { return Response.ok(new ValueWrapper<>(documentService.getDocumentVersions(namespace,type,id))).build(); }
        catch (NamespaceNotFoundException e) { return CalmResourceErrorResponses.invalidNamespaceResponse(namespace); }
        catch (DocumentNotFoundException e) { return notFound(); }
    }
    @GET @Path("{namespace}/documents/{documentType}/{id}/versions/{version}") @PermissionsAllowed(CalmHubScopes.READ)
    @Operation(summary = "Get a document version") @APIResponse(responseCode = "200", description = "Document markdown returned")
    public Response get(@PathParam("namespace") @Pattern(regexp=NAMESPACE_REGEX, message=NAMESPACE_MESSAGE) String namespace, @PathParam("documentType") String type, @PathParam("id") Integer id, @PathParam("version") @Pattern(regexp=VERSION_REGEX, message=VERSION_MESSAGE) String version) {
        if (!DOCUMENT_TYPES.contains(type)) return Response.status(400).entity("Unsupported document type").build();
        try { return Response.ok(new DocumentVersionResponse(documentService.getDocumentForVersion(namespace,type,id,version))).build(); }
        catch (NamespaceNotFoundException e) { return CalmResourceErrorResponses.invalidNamespaceResponse(namespace); }
        catch (DocumentNotFoundException | DocumentVersionNotFoundException e) { return notFound(); }
    }
    @POST @Path("{namespace}/documents/{documentType}/{id}/versions/{version}") @PermissionsAllowed(CalmHubScopes.WRITE)
    @Operation(summary = "Create an immutable document version") @APIResponse(responseCode = "201", description = "Version created")
    public Response createVersion(@PathParam("namespace") @Pattern(regexp=NAMESPACE_REGEX, message=NAMESPACE_MESSAGE) String namespace, @PathParam("documentType") String type, @PathParam("id") Integer id, @PathParam("version") @Pattern(regexp=VERSION_REGEX, message=VERSION_MESSAGE) String version, CreateDocumentRequest request) {
        Response invalid = validate(type, request); if (invalid != null) return invalid;
        try { documentService.createDocumentForVersion(request,namespace,type,id,version); return Response.created(URI.create("/api/calm/namespaces/"+namespace+"/documents/"+type+"/"+id+"/versions/"+version)).build(); }
        catch (NamespaceNotFoundException e) { return CalmResourceErrorResponses.invalidNamespaceResponse(namespace); }
        catch (DocumentNotFoundException e) { return notFound(); }
        catch (DocumentVersionExistsException e) { return Response.status(409).entity("Document version already exists").build(); }
    }
    private Response validate(String type, CreateDocumentRequest request) {
        if (!DOCUMENT_TYPES.contains(type)) return Response.status(400).entity("Unsupported document type").build();
        if (request == null || !hasMappingFrontmatter(request.getDocumentMarkdown())) return Response.status(400).entity("documentMarkdown must begin with YAML mapping frontmatter").build();
        return null;
    }
    private boolean hasMappingFrontmatter(String markdown) {
        if (markdown == null) return false;
        java.util.regex.Matcher frontmatter = java.util.regex.Pattern
                .compile("\\A---\\r?\\n(.*?)\\r?\\n---(?=\\r?\\n|\\z)", java.util.regex.Pattern.DOTALL)
                .matcher(markdown);
        if (!frontmatter.find()) return false;
        String yaml = frontmatter.group(1);
        try {
            Object parsed = new Yaml().load(yaml);
            return parsed instanceof Map<?, ?> mapping && !mapping.isEmpty();
        } catch (RuntimeException e) { return false; }
    }
    private Response notFound() { return Response.status(404).entity("Document not found").build(); }
}
