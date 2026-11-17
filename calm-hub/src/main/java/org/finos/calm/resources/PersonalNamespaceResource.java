package org.finos.calm.resources;

import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.finos.calm.domain.audit.AuditAction;
import org.finos.calm.domain.audit.AuditEntityType;
import org.finos.calm.domain.namespaces.PersonalNamespace;
import org.finos.calm.security.AuditRequestFilter;
import org.finos.calm.services.PersonalNamespaceService;
import org.finos.calm.services.PersonalNamespaceService.CreateOutcome;

import java.net.URI;
import java.util.Optional;

@Tag(name = "Storage API", description = "Numeric-ID based CALM storage endpoints")
@Path("/api/calm/me/namespace")
public class PersonalNamespaceResource {

    // Error bodies are constant strings: the principal is never echoed.
    private static final String NOT_ENABLED = "{\"error\":\"Personal namespaces are not enabled\"}";
    private static final String UNSUPPORTED_PRINCIPAL = "{\"error\":\"Your user name cannot be used for a personal namespace\"}";
    private static final String TAKEN = "{\"error\":\"Your personal namespace is held by another user\"}";

    private final PersonalNamespaceService personalNamespaceService;

    @Inject
    SecurityIdentity identity;

    @Inject
    public PersonalNamespaceResource(PersonalNamespaceService personalNamespaceService) {
        this.personalNamespaceService = personalNamespaceService;
    }

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Get My Personal Namespace",
            description = "Returns the name of the caller's personal namespace, whether it exists, and whether the caller owns it"
    )
    @Authenticated
    public Response getPersonalNamespace() {
        if (!personalNamespaceService.isActive()) {
            return error(Response.Status.NOT_FOUND.getStatusCode(), NOT_ENABLED);
        }
        Optional<PersonalNamespace> personalNamespace = personalNamespaceService.get(principal());
        if (personalNamespace.isEmpty()) {
            return error(422, UNSUPPORTED_PRINCIPAL);
        }
        return Response.ok(personalNamespace.get()).build();
    }

    @PUT
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Create My Personal Namespace",
            description = "Creates the caller's personal namespace, with an admin grant for the caller and no public read grant. Does nothing if the caller already owns it"
    )
    @Authenticated
    public Response createPersonalNamespace() {
        if (!personalNamespaceService.isActive()) {
            return error(Response.Status.NOT_FOUND.getStatusCode(), NOT_ENABLED);
        }
        String principal = principal();
        Optional<CreateOutcome> outcome = personalNamespaceService.create(principal);
        if (outcome.isEmpty()) {
            return error(422, UNSUPPORTED_PRINCIPAL);
        }
        // namespaceFor cannot be empty here, because create succeeded for the same principal.
        String name = personalNamespaceService.namespaceFor(principal).orElseThrow();
        return switch (outcome.get()) {
            case CREATED -> {
                // The path has no {namespace} parameter, so the audit filter cannot find the entity itself.
                AuditRequestFilter.stage(new AuditRequestFilter.AuditContext(
                        AuditEntityType.NAMESPACE, AuditAction.CREATE, name, null, null, null));
                yield Response.created(URI.create("/api/calm/namespaces/" + name))
                        .entity(new PersonalNamespace(name, true, true))
                        .build();
            }
            case ALREADY_OWNED -> Response.ok(new PersonalNamespace(name, true, true)).build();
            case TAKEN -> error(Response.Status.CONFLICT.getStatusCode(), TAKEN);
        };
    }

    private String principal() {
        return identity.getPrincipal().getName();
    }

    private static Response error(int status, String body) {
        return Response.status(status).type(MediaType.APPLICATION_JSON).entity(body).build();
    }
}
