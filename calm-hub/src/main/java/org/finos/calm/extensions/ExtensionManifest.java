package org.finos.calm.extensions;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record ExtensionManifest(
        String id,
        Integer hubApi,
        String name,
        String description,
        String provider,
        Backend backend,
        List<Route> routes,
        Contributes contributes
) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Backend(String url) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Route(String method, String path, String scope, Boolean readOnly) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Contributes(Screen screen) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Screen(String title, String route) {}

    public Route screenRoute() {
        if (contributes == null || contributes.screen() == null || routes == null) {
            return null;
        }
        String path = contributes.screen().route();
        return routes.stream()
                .filter(r -> "GET".equals(r.method()) && r.path() != null && r.path().equals(path))
                .findFirst()
                .orElse(null);
    }
}
