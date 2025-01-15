package org.finos.calm.resources;

import com.fasterxml.jackson.core.JsonProcessingException;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.bson.json.JsonParseException;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.media.Content;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponses;
import org.finos.calm.domain.Adr;
import org.finos.calm.domain.AdrBuilder;
import org.finos.calm.domain.AdrContent;
import org.finos.calm.domain.AdrStatus;
import org.finos.calm.domain.NewAdr;
import org.finos.calm.domain.ValueWrapper;
import org.finos.calm.domain.exception.AdrNotFoundException;
import org.finos.calm.domain.exception.AdrPersistenceError;
import org.finos.calm.domain.exception.AdrRevisionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.AdrStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.URISyntaxException;
import java.time.LocalDateTime;

/**
 * Resource for managing ADRs in a given namespace
 */
@Path("/calm/namespaces")
public class AdrResource {

    private final AdrStore store;
    private final Logger logger = LoggerFactory.getLogger(AdrResource.class);

    public AdrResource(AdrStore store) {
        this.store = store;
    }

    /**
     * Retrieve a list of ADRs in a given namespace
     * @param namespace the namespace to retrieve ADRs for
     * @return a list of ADRs in the given namespace
     */
    @GET
    @Path("{namespace}/adrs")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Retrieve ADRs in a given namespace",
            description = "ADRs stored in a given namespace"
    )
    public Response getAdrsForNamespace(@PathParam("namespace") String namespace) {
        try {
            return Response.ok(new ValueWrapper<>(store.getAdrsForNamespace(namespace))).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when retrieving ADRs", namespace, e);
            return invalidNamespaceResponse(namespace);
        }
    }

    /**
     * Create a new ADR in the DRAFT state
     * @param namespace the namespace to create the ADR in
     * @param newAdr the new ADR to be created
     * @return created response with Location header
     * @throws URISyntaxException cannot produce location URL
     */
    @POST
    @Path("{namespace}/adrs")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Create ADR for namespace",
            description = "Creates an ADR for a given namespace with an allocated ID and revision 1"
    )
    public Response createAdrForNamespace(@PathParam("namespace") String namespace, NewAdr newAdr) throws URISyntaxException {
        AdrContent adrContent = AdrContent.builderFromNewAdr(newAdr)
                .status(AdrStatus.DRAFT)
                .creationDateTime(LocalDateTime.now())
                .updateDateTime(LocalDateTime.now())
                .build();

        Adr adr = AdrBuilder.builder()
                .namespace(namespace)
                .revision(1)
                .adrContent(adrContent)
                .build();

        try {
            return adrWithLocationResponse(store.createAdrForNamespace(adr));
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when creating ADR", namespace, e);
            return invalidNamespaceResponse(namespace);
        } catch (JsonParseException | JsonProcessingException e) {
            logger.error("Cannot parse ADR for namespace [{}]. ADR: [{}]", namespace, newAdr, e);
            return invalidAdrJsonResponse(namespace);
        }
    }

    /**
     * Update an existing ADRs contents
     * @param namespace the namespace the ADR is in
     * @param adrId the ID of the ADR
     * @param newAdrRevision the new ADR content
     * @return created with a Location header
     * @throws URISyntaxException cannot produce Location header
     */
    @POST
    @Path("{namespace}/adrs/{adrId}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Update ADR for namespace",
            description = "Updates an ADR for a given namespace. Creates a new revision."
    )
    public Response updateAdrForNamespace(@PathParam("namespace") String namespace, @PathParam("adrId") int adrId, NewAdr newAdrRevision) throws URISyntaxException {
        AdrContent adrContent = AdrContent.builderFromNewAdr(newAdrRevision)
                .updateDateTime(LocalDateTime.now())
                .build();

        Adr adr = AdrBuilder.builder()
                .namespace(namespace)
                .id(adrId)
                .adrContent(adrContent)
                .build();

        try {
            return adrWithLocationResponse(store.updateAdrForNamespace(adr));
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when creating ADR", namespace, e);
            return invalidNamespaceResponse(namespace);
        } catch (JsonParseException | JsonProcessingException e) {
            logger.error("Cannot parse new ADR Revision for namespace [{}]. New ADR Revision: [{}]", namespace, newAdrRevision, e);
            return invalidAdrJsonResponse(namespace);
        } catch(AdrNotFoundException e) {
            logger.error("Invalid ADR [{}] when creating new revision of ADR", adrId, e);
            return invalidAdrResponse(adrId);
        } catch(AdrRevisionNotFoundException e) {
            logger.error("No existing revision of ADR [{}] found", adrId, e);
            return invalidLatestRevisionResponse(adrId);
        } catch(AdrPersistenceError e) {
            logger.error("Error saving updated ADR [{}]", adr);
            return serverErrorSavingAdr(adrId);
        }
    }

    /**
     * Gets the latest revision of an ADR
     * @param namespace the namespace the ADR belongs to
     * @param adrId the ID of the requested ADR
     * @return the requested ADR document
     */
    @GET
    @Path("{namespace}/adrs/{adrId}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Retrieve the latest revision of an ADR",
            description = "Retrieve the latest revision of an ADR"
    )
    @APIResponses(value = {
            @APIResponse(
                    responseCode = "200",
                    content = @Content(schema = @Schema(implementation = Adr.class))
            )
    })
    public Response getAdr(@PathParam("namespace") String namespace, @PathParam("adrId") int adrId) {
        Adr adr = AdrBuilder.builder()
                .namespace(namespace)
                .id(adrId)
                .build();

        try {
            return Response.ok(store.getAdr(adr)).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when getting an ADR", namespace, e);
            return invalidNamespaceResponse(namespace);
        } catch (AdrNotFoundException e) {
            logger.error("Invalid ADR [{}] when getting an ADR", adrId, e);
            return invalidAdrResponse(adrId);
        } catch (AdrRevisionNotFoundException e) {
            logger.error("Could not get latest revision of ADR [{}]", adrId, e);
            return invalidLatestRevisionResponse(adrId);
        } catch(JsonProcessingException e) {
            return invalidGetAdrResponse(adrId);
        }
    }

    /**
     * Gets the list of revisions of an ADR
     * @param namespace the namespace the ADR belongs to
     * @param adrId the ID of the requested ADR
     * @return a list of revision numbers
     */
    @GET
    @Path("{namespace}/adrs/{adrId}/revisions")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Retrieve a list of revisions for a given ADR",
            description = "The most recent revision is the canonical ADR, with others available for audit or exploring changes."
    )
    public Response getAdrRevisions(@PathParam("namespace") String namespace, @PathParam("adrId") int adrId) {
        Adr adr = AdrBuilder.builder()
                .namespace(namespace)
                .id(adrId)
                .build();

        try {
            return Response.ok(new ValueWrapper<>(store.getAdrRevisions(adr))).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when getting revisions of ADR", namespace, e);
            return invalidNamespaceResponse(namespace);
        } catch (AdrNotFoundException e) {
            logger.error("Invalid ADR [{}] when getting versions of ADR", adrId, e);
            return invalidAdrResponse(adrId);
        } catch(AdrRevisionNotFoundException e) {
            logger.error("Could not find any revisions of ADR: [{}]", adrId, e);
            return invalidAdrRevisions(adrId);
        }
    }

    /**
     * Gets a specific revision of an ADR
     * @param namespace the namespace the ADR belongs to
     * @param adrId the ID of the requested ADR
     * @param revision the revision of the ADR being requested
     * @return the requested revision of the requested ADR
     */
    @GET
    @Path("{namespace}/adrs/{adrId}/revisions/{revision}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Retrieve a specific revision of an ADR",
            description = "Retrieve a specific revision of an ADR"
    )
    @APIResponses(value = {
            @APIResponse(
                    responseCode = "200",
                    content = @Content(schema = @Schema(implementation = Adr.class))
            )
    })
    public Response getAdrRevision(@PathParam("namespace") String namespace, @PathParam("adrId") int adrId, @PathParam("revision") int revision) {
        Adr adr = AdrBuilder.builder()
                .namespace(namespace)
                .id(adrId)
                .revision(revision)
                .build();

        try {
            return Response.ok(store.getAdrRevision(adr)).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when getting an ADR", namespace, e);
            return invalidNamespaceResponse(namespace);
        } catch (AdrNotFoundException e) {
            logger.error("Invalid ADR [{}] when getting an ADR revision", adrId, e);
            return invalidAdrResponse(adrId);
        } catch (AdrRevisionNotFoundException e) {
            logger.error("Invalid revision [{}] when getting an ADR", revision, e);
            return invalidRevisionResponse(revision);
        } catch(JsonProcessingException e) {
            return invalidGetAdrResponse(adrId);
        }
    }

    /**
     * Update the status of an existing ADR
     * @param namespace the namespace the ADR is in
     * @param adrId the ID of the ADR
     * @param adrStatus the new status of the ADR
     * @return created with a Location header
     * @throws URISyntaxException cannot produce Location header
     */
    @POST
    @Path("{namespace}/adrs/{adrId}/status/{adrStatus}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Update the status of ADR for namespace",
            description = "Updates the status of an ADR for a given namespace. Creates a new revision."
    )
    public Response updateAdrStatusForNamespace(@PathParam("namespace") String namespace, @PathParam("adrId") int adrId, @PathParam("adrStatus") AdrStatus adrStatus) throws URISyntaxException {

        Adr adr = AdrBuilder.builder()
                .namespace(namespace)
                .id(adrId)
                .build();

        try {
            return adrWithLocationResponse(store.updateAdrStatus(adr, adrStatus));
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when updating status of ADR", namespace, e);
            return invalidNamespaceResponse(namespace);
        } catch (JsonParseException | JsonProcessingException e) {
            logger.error("Cannot parse existing ADR Revision for namespace [{}] while updating status of ADR [{}].", namespace, adrId, e);
            return invalidAdrJsonResponse(namespace);
        } catch(AdrNotFoundException e) {
            logger.error("Invalid ADR [{}] when updating the status of ADR", adrId, e);
            return invalidAdrResponse(adrId);
        } catch(AdrRevisionNotFoundException e) {
            logger.error("No existing revision of ADR [{}] found", adrId, e);
            return invalidLatestRevisionResponse(adrId);
        } catch(AdrPersistenceError e) {
            logger.error("Error saving updated ADR [{}]", adr);
            return serverErrorSavingAdr(adrId);
        }
    }

    private Response adrWithLocationResponse(Adr adr) throws URISyntaxException {
        return Response.created(new URI("/calm/namespaces/" + adr.namespace() + "/adrs/" + adr.id() + "/revisions/" + adr.revision())).build();
    }

    private Response invalidNamespaceResponse(String namespace) {
        return Response.status(Response.Status.NOT_FOUND).entity("Invalid namespace provided: " + namespace).build();
    }

    private Response invalidAdrJsonResponse(String adrJson) {
        return Response.status(Response.Status.BAD_REQUEST).entity("The ADR JSON could not be parsed: " + adrJson).build();
    }

    private Response invalidGetAdrResponse(int adrId) {
        return Response.status(Response.Status.NOT_FOUND).entity("Could not process ADR when getting it: " + adrId).build();
    }

    private Response invalidAdrResponse(int adrId) {
        return Response.status(Response.Status.NOT_FOUND).entity("Invalid adrId provided: " + adrId).build();
    }

    private Response invalidRevisionResponse(int revision) {
        return Response.status(Response.Status.NOT_FOUND).entity("Invalid revision provided: " + revision).build();
    }

    private Response invalidLatestRevisionResponse(int adrId) {
        return Response.status(Response.Status.NOT_FOUND).entity("Latest revision not found for ADR: [{}]: " + adrId).build();
    }

    private Response invalidAdrRevisions(int adrId) {
        return Response.status(Response.Status.NOT_FOUND).entity("Revisions not found for ADR: [{}]: " + adrId).build();
    }

    private Response serverErrorSavingAdr(int adrId) {
        return Response.status(Response.Status.INTERNAL_SERVER_ERROR).entity("Could not save update of ADR: [{}]:" + adrId).build();
    }
}
