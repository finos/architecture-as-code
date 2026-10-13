package org.finos.calm.resources;

import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.finos.calm.config.UiConfig;
import org.finos.calm.domain.ui.UiConfigResponse;

import java.util.List;

@Tag(name = "UI", description = "Configuration for CALM Hub UI")
@Path("/api/calm/ui")
public class UiConfigResource {

    private final UiConfig config;
    private final SecurityIdentity identity;

    @Inject
    public UiConfigResource(UiConfig config, SecurityIdentity identity) {
        this.config = config;
        this.identity = identity;
    }

    @GET
    @Path("config")
    @Produces(MediaType.APPLICATION_JSON)
    @Authenticated
    @Operation(
            summary = "Get operator-supplied UI configuration",
            description = "Returns the environment label, the caller's identity and the extra values and links "
                    + "that the operator configured under calm.ui.*. A section that is not configured or not "
                    + "enabled is left out of the response."
    )
    public Response getUiConfig() {
        return Response.ok(new UiConfigResponse(environment(), identity(), items())).build();
    }

    private UiConfigResponse.Environment environment() {
        UiConfig.Environment env = config.environment();
        return env.name()
                .filter(name -> !name.isBlank())
                .map(name -> new UiConfigResponse.Environment(name, env.colour()))
                .orElse(null);
    }

    private UiConfigResponse.Identity identity() {
        if (!config.identity().enabled()) {
            return null;
        }
        List<String> roles = config.identity().showRoles()
                ? identity.getRoles().stream().sorted().toList()
                : null;
        return new UiConfigResponse.Identity(identity.getPrincipal().getName(), roles);
    }

    private List<UiConfigResponse.Item> items() {
        if (config.items().isEmpty()) {
            return null;
        }
        return config.items().stream()
                .map(item -> new UiConfigResponse.Item(item.label(), item.value().orElse(null), item.url().orElse(null)))
                .toList();
    }
}
