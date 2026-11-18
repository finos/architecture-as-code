package org.finos.calm.domain.ui;

import io.quarkus.runtime.annotations.RegisterForReflection;

import java.util.List;

/**
 * Body of {@code GET /api/calm/ui/config}. A null section or field is left out of the JSON, which tells
 * the UI that the operator did not configure or enable it, so the UI uses its default.
 */
@RegisterForReflection
public record UiConfigResponse(Environment environment, Identity identity, List<Item> items,
                               Branding branding, Navigation navigation) {

    @RegisterForReflection
    public record Environment(String name, String colour) {}

    @RegisterForReflection
    public record Identity(String name, List<String> roles) {}

    @RegisterForReflection
    public record Item(String label, String value, String url) {}

    /** Each logo is a Hub URL that changes when the image changes. */
    @RegisterForReflection
    public record Branding(String organisationName, String applicationName, String colour, String colourDark, Logo logo) {}

    @RegisterForReflection
    public record Logo(String light, String dark) {}

    @RegisterForReflection
    public record Navigation(String layout, boolean showNamespaces, boolean showControlDomains,
                             String extensionsHeading, String startPage) {}
}
