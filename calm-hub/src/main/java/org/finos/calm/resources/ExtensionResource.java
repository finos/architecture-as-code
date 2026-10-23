package org.finos.calm.resources;

import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.validation.constraints.Pattern;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.finos.calm.domain.ValueWrapper;
import org.finos.calm.extensions.ExtensionIdentitySigner;
import org.finos.calm.extensions.ExtensionManifest;
import org.finos.calm.extensions.ExtensionRegistry;
import org.finos.calm.extensions.ExtensionScreenClient;
import org.finos.calm.security.CalmHubPermissionChecker;

import java.util.Map;

@Tag(name = "Extensions", description = "Extensions that the operator enabled on this CALM Hub")
@Path("/api/calm/extensions")
@Produces(MediaType.APPLICATION_JSON)
@Authenticated
public class ExtensionResource {

    private static final String ID_REGEX = "^[a-z0-9][a-z0-9-]{0,62}$";

    private final ExtensionRegistry registry;
    private final ExtensionIdentitySigner signer;
    private final ExtensionScreenClient client;
    private final CalmHubPermissionChecker permissionChecker;
    private final SecurityIdentity identity;

    @Inject
    public ExtensionResource(ExtensionRegistry registry, ExtensionIdentitySigner signer, ExtensionScreenClient client,
                             CalmHubPermissionChecker permissionChecker, SecurityIdentity identity) {
        this.registry = registry;
        this.signer = signer;
        this.client = client;
        this.permissionChecker = permissionChecker;
        this.identity = identity;
    }

    public record ExtensionSummary(String id, String name, String description, String provider, ScreenSummary screen) {}

    public record ScreenSummary(String title) {}

    @GET
    @Operation(summary = "List the enabled extensions", description = "Leaves out backend addresses, which are for Hub only.")
    public Response listExtensions() {
        return Response.ok(new ValueWrapper<>(registry.all().stream().map(ExtensionResource::summary).toList())).build();
    }

    @GET
    @Path("{id}/screen")
    @Operation(summary = "Get the content of an extension screen", description = "Hub calls the extension with a signed identity of the caller and returns its blocks.")
    public Response getScreen(@PathParam("id") @Pattern(regexp = ID_REGEX) String id) {
        ExtensionManifest manifest = registry.find(id).orElse(null);
        ExtensionManifest.Route route = manifest == null ? null : manifest.screenRoute();
        if (route == null) {
            return Response.status(Response.Status.NOT_FOUND).entity(Map.of("error", "No extension screen with this id")).build();
        }
        if ("global_admin".equals(route.scope()) && !permissionChecker.hasGlobalAdmin(identity)) {
            return Response.status(Response.Status.FORBIDDEN).entity(Map.of("error", "This screen needs global admin access")).build();
        }
        String assertion = signer.sign(identity.getPrincipal().getName(), manifest.id());
        try {
            String screen = client.get(manifest, route.path(), assertion);
            return Response.ok(screen).build();
        } catch (ExtensionScreenClient.ExtensionCallException e) {
            return Response.status(Response.Status.BAD_GATEWAY).entity(Map.of("error", "The extension did not return a valid screen")).build();
        }
    }

    private static ExtensionSummary summary(ExtensionManifest m) {
        ScreenSummary screen = m.screenRoute() == null ? null : new ScreenSummary(m.contributes().screen().title());
        return new ExtensionSummary(m.id(), m.name(), m.description(), m.provider(), screen);
    }
}
