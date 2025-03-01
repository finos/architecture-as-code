package org.finos.calm.resources;

import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.media.Content;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponses;
import org.finos.calm.domain.adr.Adr;
import org.finos.calm.domain.adr.AdrMeta;
import org.finos.calm.domain.adr.Status;
import org.finos.calm.domain.adr.NewAdrRequest;
import org.finos.calm.domain.ValueWrapper;
import org.finos.calm.domain.exception.AdrNotFoundException;
import org.finos.calm.domain.exception.AdrParseException;
import org.finos.calm.domain.exception.AdrPersistenceException;
import org.finos.calm.domain.exception.AdrRevisionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.AdrStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.URISyntaxException;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.function.Function;

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
     *
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
        } catch(Exception e) {
            return handleException(e, namespace);
        }
    }

    /**
     * Create a new ADR in the DRAFT state
     *
     * @param namespace the namespace to create the ADR in
     * @param newAdrRequest    the new ADR to be created
     * @return created response with Location header
     */
    @POST
    @Path("{namespace}/adrs")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Create ADR for namespace",
            description = "Creates an ADR for a given namespace with an allocated ID and revision 1"
    )
    public Response createAdrForNamespace(@PathParam("namespace") String namespace, NewAdrRequest newAdrRequest) {
        Adr adr = new Adr.AdrBuilder(newAdrRequest)
                .setStatus(Status.draft)
                .setCreationDateTime(LocalDateTime.now())
                .setUpdateDateTime(LocalDateTime.now())
                .build();

        AdrMeta adrMeta = new AdrMeta.AdrMetaBuilder()
                .setNamespace(namespace)
                .setRevision(1)
                .setAdr(adr)
                .build();

        try {
            return adrWithLocationResponse(store.createAdrForNamespace(adrMeta));
        } catch(Exception e) {
            return handleException(e, namespace);
        }
    }

    /**
     * Update an existing ADRs contents
     *
     * @param namespace      the namespace the ADR is in
     * @param adrId          the ID of the ADR
     * @param newAdrRequest the new ADR content
     * @return created with a Location header
     */
    @POST
    @Path("{namespace}/adrs/{adrId}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Update ADR for namespace",
            description = "Updates an ADR for a given namespace. Creates a new revision."
    )
    public Response updateAdrForNamespace(@PathParam("namespace") String namespace, @PathParam("adrId") int adrId, NewAdrRequest newAdrRequest) {
        Adr adr = new Adr.AdrBuilder(newAdrRequest)
                .setUpdateDateTime(LocalDateTime.now())
                .build();

        AdrMeta adrMeta = new AdrMeta.AdrMetaBuilder()
                .setNamespace(namespace)
                .setId(adrId)
                .setAdr(adr)
                .build();

        try {
            return adrWithLocationResponse(store.updateAdrForNamespace(adrMeta));
        } catch(Exception e) {
            return handleException(e, namespace);
        }
    }

    /**
     * Gets the latest revision of an ADR
     *
     * @param namespace the namespace the ADR belongs to
     * @param adrId     the ID of the requested ADR
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
                    content = @Content(schema = @Schema(implementation = AdrMeta.class))
            )
    })
    public Response getAdr(@PathParam("namespace") String namespace, @PathParam("adrId") int adrId) {
        AdrMeta adrMeta = new AdrMeta.AdrMetaBuilder()
                .setNamespace(namespace)
                .setId(adrId)
                .build();

        try {
            return Response.ok(store.getAdr(adrMeta)).build();
        } catch(Exception e) {
            return handleException(e, namespace, adrId);
        }
    }

    /**
     * Gets the list of revisions of an ADR
     *
     * @param namespace the namespace the ADR belongs to
     * @param adrId     the ID of the requested ADR
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
        AdrMeta adrMeta = new AdrMeta.AdrMetaBuilder()
                .setNamespace(namespace)
                .setId(adrId)
                .build();

        try {
            return Response.ok(new ValueWrapper<>(store.getAdrRevisions(adrMeta))).build();
        } catch(NamespaceNotFoundException | AdrNotFoundException | AdrRevisionNotFoundException e) {
            return handleException(e, namespace, adrId);
        }
    }

    /**
     * Gets a specific revision of an ADR
     *
     * @param namespace the namespace the ADR belongs to
     * @param adrId     the ID of the requested ADR
     * @param revision  the revision of the ADR being requested
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
                    content = @Content(schema = @Schema(implementation = AdrMeta.class))
            )
    })
    public Response getAdrRevision(@PathParam("namespace") String namespace, @PathParam("adrId") int adrId, @PathParam("revision") int revision) {
        AdrMeta adrMeta = new AdrMeta.AdrMetaBuilder()
                .setNamespace(namespace)
                .setId(adrId)
                .setRevision(revision)
                .build();

        try {
            return Response.ok(store.getAdrRevision(adrMeta)).build();
        } catch(Exception e) {
            return handleException(e, namespace, adrId, revision);
        }
    }

    /**
     * Update the status of an existing ADR
     *
     * @param namespace the namespace the ADR is in
     * @param adrId     the ID of the ADR
     * @param status the new status of the ADR
     * @return created with a Location header
     * @throws URISyntaxException cannot produce Location header
     */
    @POST
    @Path("{namespace}/adrs/{adrId}/status/{status}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Update the status of ADR for namespace",
            description = "Updates the status of an ADR for a given namespace. Creates a new revision."
    )
    public Response updateAdrStatusForNamespace(@PathParam("namespace") String namespace, @PathParam("adrId") int adrId, @PathParam("status") Status status) throws URISyntaxException {

        AdrMeta adrMeta = new AdrMeta.AdrMetaBuilder()
                .setNamespace(namespace)
                .setId(adrId)
                .build();

        try {
            return adrWithLocationResponse(store.updateAdrStatus(adrMeta, status));
        } catch(Exception e) {
            return handleException(e, namespace, adrId);
        }
    }

    private Response adrWithLocationResponse(AdrMeta adrMeta) throws URISyntaxException {
        return Response.created(new URI("/calm/namespaces/" + adrMeta.getNamespace() + "/adrs/" + adrMeta.getId() + "/revisions/" + adrMeta.getRevision())).build();
    }

    private Response handleException(Exception e, String namespace) {
        return handleException(e, namespace, 0, 0);
    }

    private Response handleException(Exception e, String namespace, int adrId) {
        return handleException(e, namespace, adrId, 0);
    }

    private Response handleException(Exception e, String namespace, int adrId, int revision) {
        Map<Class<? extends Exception>, Function<Exception, Response>> handlers = Map.of(
                NamespaceNotFoundException.class, ex -> handleNamespaceNotFoundException(namespace, ex),
                AdrNotFoundException.class, ex -> handleAdrNotFoundException(adrId, ex),
                AdrRevisionNotFoundException.class, ex -> handleAdrRevisionNotFoundException(adrId, revision, ex),
                AdrParseException.class, this::handleAdrParseException,
                AdrPersistenceException.class, ex -> handleAdrPersistenceException(adrId, ex)
        );

        return handlers.getOrDefault(e.getClass(), ex -> {
            logger.error("Unexpected exception occurred", ex);
            return Response.serverError().build();
        }).apply(e);
    }

    private Response handleNamespaceNotFoundException(String namespace, Exception ex) {
        logger.error("Could not find namespace [{}]", namespace, ex);
        return Response.status(Response.Status.NOT_FOUND).entity("Could not find namespace: " + namespace).build();
    }

    private Response handleAdrNotFoundException(int adrId, Exception ex) {
        logger.error("Could not find ADR [{}]", adrId, ex);
        return Response.status(Response.Status.NOT_FOUND).entity("Could not find ADR: " + adrId).build();
    }

    private Response handleAdrRevisionNotFoundException(int adrId, int revision, Exception ex) {
        if(revision == 0) {
            logger.error("Could not find latest revision of ADR [{}]", adrId, ex);
            return Response.status(Response.Status.NOT_FOUND).entity("Latest revision not found for ADR: [{}]: " + adrId).build();
        } else {
            logger.error("Could not find revision [{}] of ADR [{}]", revision, adrId, ex);
            return Response.status(Response.Status.NOT_FOUND).entity("Revision " + revision + " not found for ADR: [{}]: " + adrId).build();
        }
    }

    private Response handleAdrParseException(Exception ex) {
        logger.error("Could not parse ADR JSON", ex);
        return Response.status(Response.Status.INTERNAL_SERVER_ERROR).entity("Could not parse ADR JSON").build();
    }

    private Response handleAdrPersistenceException(int adrId, Exception ex) {
        logger.error("Could not persist update of ADR [{}]", adrId, ex);
        return Response.status(Response.Status.INTERNAL_SERVER_ERROR).entity("Could not persist update of ADR: [{}]:" + adrId).build();
    }
}