package org.finos.calm.resources;

import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Request;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.finos.calm.assets.BrandingLogos;
import org.finos.calm.config.UiConfig;
import org.finos.calm.domain.ui.UiConfigResponse;

import java.util.List;
import java.util.stream.Stream;

@Tag(name = "UI", description = "Configuration for CALM Hub UI")
@Path("/api/calm/ui")
public class UiConfigResource {

    static final String LOGO_PATH = "/api/calm/ui/branding/logo/";

    private final UiConfig config;
    private final SecurityIdentity identity;
    private final BrandingLogos logos;

    @Inject
    public UiConfigResource(UiConfig config, SecurityIdentity identity, BrandingLogos logos) {
        this.config = config;
        this.identity = identity;
        this.logos = logos;
    }

    @GET
    @Path("config")
    @Produces(MediaType.APPLICATION_JSON)
    @Authenticated
    @Operation(
            summary = "Get operator-supplied UI configuration",
            description = "Returns the environment label, the caller's identity, the extra values and links, the "
                    + "branding and the navigation that the operator configured under calm.ui.*. A section that is "
                    + "not configured or not enabled is left out of the response."
    )
    public Response getUiConfig() {
        return Response.ok(new UiConfigResponse(environment(), identity(), items(), branding(), navigation())).build();
    }

    @GET
    @Path("branding/logo/{variant}")
    @Produces({"image/png", "image/jpeg", "image/webp", "image/svg+xml"})
    @Authenticated
    @Operation(
            summary = "Get the organisation logo",
            description = "Returns the light or dark logo of calm.ui.branding.logo.*, or 404 if it is not configured."
    )
    public Response getLogo(@PathParam("variant") String variant, @QueryParam("v") String version, @Context Request request) {
        return logos.logo(variant)
                .map(asset -> asset.response(request, version))
                .orElseGet(() -> Response.status(Response.Status.NOT_FOUND).build());
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

    private UiConfigResponse.Branding branding() {
        UiConfig.Branding branding = config.branding();
        String light = logoUrl(BrandingLogos.LIGHT);
        UiConfigResponse.Logo logo = light == null ? null : new UiConfigResponse.Logo(light, logoUrl(BrandingLogos.DARK));
        String organisationName = branding.organisationName().orElse(null);
        String applicationName = branding.applicationName().orElse(null);
        String colour = branding.colour().orElse(null);
        String colourDark = branding.colourDark().orElse(null);
        if (Stream.of(organisationName, applicationName, colour, colourDark, logo).allMatch(value -> value == null)) {
            return null;
        }
        return new UiConfigResponse.Branding(organisationName, applicationName, colour, colourDark, logo);
    }

    private String logoUrl(String variant) {
        return logos.logo(variant).map(asset -> LOGO_PATH + variant + "?v=" + asset.version()).orElse(null);
    }

    private UiConfigResponse.Navigation navigation() {
        UiConfig.Navigation navigation = config.navigation();
        boolean isDefault = "menu".equals(navigation.layout())
                && navigation.showNamespaces()
                && navigation.showControlDomains()
                && navigation.extensionsHeading().isEmpty()
                && navigation.startPage().isEmpty();
        if (isDefault) {
            return null;
        }
        return new UiConfigResponse.Navigation(navigation.layout(), navigation.showNamespaces(),
                navigation.showControlDomains(), navigation.extensionsHeading().orElse(null),
                navigation.startPage().orElse(null));
    }
}
