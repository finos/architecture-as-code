package org.finos.calm.extensions;

import org.finos.calm.domain.extensions.ExtensionManifest;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Matches a checked path against the declared route templates only (ADR 0011). A {@code {name}}
 * segment matches one non-empty segment. When two templates match, the one with more literal
 * segments wins, as in JAX-RS.
 */
public final class ExtensionRouteMatcher {

    /** The matched route, and its path parameters in their raw, percent-encoded form. */
    record RouteMatch(ExtensionManifest.Route route, Map<String, String> parameters) {}

    private ExtensionRouteMatcher() {
    }

    static RouteMatch match(ExtensionManifest manifest, String method, String path) {
        return match(manifest, method, path, route -> true);
    }

    /** {@code accepted} limits the {@code Allow} value of a 405 to the routes that Hub accepts now. */
    static RouteMatch match(ExtensionManifest manifest, String method, String path,
                            Predicate<ExtensionManifest.Route> accepted) {
        RouteMatch best = null;
        int bestLiterals = -1;
        boolean pathMatched = false;
        for (ExtensionManifest.Route route : manifest.routes()) {
            Optional<Map<String, String>> parameters = parameters(route.path(), path);
            if (parameters.isEmpty()) {
                continue;
            }
            pathMatched = true;
            int literals = route.path().split("/", -1).length - parameters.get().size();
            if (route.method().equals(method) && literals > bestLiterals) {
                best = new RouteMatch(route, parameters.get());
                bestLiterals = literals;
            }
        }
        if (best != null) {
            return best;
        }
        throw pathMatched
                ? new ExtensionProxyException(405, "The extension route does not allow this method",
                        Map.of("Allow", allowedMethods(manifest, path, accepted)))
                : new ExtensionProxyException(404, "The extension has no such route");
    }

    /**
     * The {@code Allow} value: the methods of the routes that match the path and pass {@code allowed}.
     * JAX-RS answers {@code HEAD} with the {@code GET} resource method, so {@code HEAD} goes with {@code GET}.
     */
    static String allowedMethods(ExtensionManifest manifest, String path, Predicate<ExtensionManifest.Route> allowed) {
        return manifest.routes().stream()
                .filter(allowed)
                .filter(route -> parameters(route.path(), path).isPresent())
                .map(ExtensionManifest.Route::method)
                .flatMap(method -> "GET".equals(method) ? Stream.of("GET", "HEAD") : Stream.of(method))
                .distinct()
                .sorted()
                .collect(Collectors.joining(", "));
    }

    static void rejectEncodedLiterals(RouteMatch match, String rawPath) {
        String[] template = match.route().path().split("/", -1);
        String[] raw = rawPath.split("/", -1);
        for (int i = 0; i < template.length; i++) {
            if (!template[i].startsWith("{") && raw[i].contains("%")) {
                throw new ExtensionProxyException(400, "Percent-encoding is not allowed in route literals");
            }
        }
    }

    /** The parameters of {@code path} when it matches {@code template}, in their raw form. */
    public static Optional<Map<String, String>> parameters(String template, String path) {
        String[] templateSegments = template.split("/", -1);
        String[] pathSegments = path.split("/", -1);
        if (templateSegments.length != pathSegments.length) {
            return Optional.empty();
        }
        Map<String, String> parameters = new LinkedHashMap<>();
        for (int i = 0; i < templateSegments.length; i++) {
            String segment = templateSegments[i];
            if (segment.length() > 2 && segment.startsWith("{") && segment.endsWith("}")) {
                if (pathSegments[i].isEmpty()) {
                    return Optional.empty();
                }
                parameters.put(segment.substring(1, segment.length() - 1), pathSegments[i]);
            } else if (!segment.equals(pathSegments[i])) {
                return Optional.empty();
            }
        }
        return Optional.of(parameters);
    }
}
