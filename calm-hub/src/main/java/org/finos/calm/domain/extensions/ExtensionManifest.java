package org.finos.calm.domain.extensions;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.quarkus.runtime.annotations.RegisterForReflection;
import jakarta.json.bind.annotation.JsonbProperty;
import jakarta.json.bind.annotation.JsonbPropertyOrder;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import java.util.function.Predicate;

/**
 * A validated {@code extension.json} (ADR 0012). The manifest JSON Schema in
 * {@code META-INF/calm-extensions/schema} is the contract; these records give code access to it.
 * {@code GET /api/calm/extensions} also returns them, so a null field is left out of the JSON.
 */
@RegisterForReflection
@JsonbPropertyOrder({"id", "version", "hubApi", "name", "description", "provider", "routes", "commands", "contributes"})
public record ExtensionManifest(
        String id,
        String version,
        int hubApi,
        String name,
        String description,
        String provider,
        List<Route> routes,
        Map<String, Command> commands,
        Contributions contributes
) {

    public ExtensionManifest {
        routes = routes == null ? List.of() : List.copyOf(routes);
        // Sorted by name, so that the CLI and the MCP tool list have a stable order (ADR 0014).
        commands = commands == null ? Map.of() : Collections.unmodifiableMap(new TreeMap<>(commands));
        contributes = contributes == null ? Contributions.NONE : contributes;
    }

    public Optional<Route> route(String routeId) {
        return routes.stream().filter(r -> r.id().equals(routeId)).findFirst();
    }

    /** A copy with only the routes that {@code keep} accepts, and the commands and contributions that use them. */
    public ExtensionManifest withRoutes(Predicate<Route> keep) {
        List<Route> kept = routes.stream().filter(keep).toList();
        Predicate<String> routeKept = id -> kept.stream().anyMatch(r -> r.id().equals(id));
        Map<String, Command> keptCommands = new TreeMap<>();
        commands.forEach((name, command) -> {
            if (routeKept.test(command.route())) {
                keptCommands.put(name, command);
            }
        });
        return new ExtensionManifest(id, version, hubApi, name, description, provider, kept, keptCommands,
                contributes.withRoutes(routeKept));
    }

    @RegisterForReflection
    @JsonbPropertyOrder({"id", "method", "path", "scope", "readOnly"})
    public record Route(String id, String method, String path, String scope, boolean readOnly) {}

    @RegisterForReflection
    @JsonbPropertyOrder({"route", "description", "input", "output", "destructive", "idempotent"})
    public record Command(
            String route,
            String description,
            Map<String, Object> input,
            Map<String, Object> output,
            Boolean destructive,
            Boolean idempotent
    ) {}

    /** The closed set of extension points. {@code decorator-views} have no route; the others name one by id. */
    @RegisterForReflection
    // Yasson matches the order against Java names, not JSON names.
    @JsonbPropertyOrder({"screen", "designerTab", "landingCard", "detailPanel", "action", "searchProvider", "chat",
            "decoratorViews"})
    public record Contributions(
            List<RouteContribution> screen,
            @JsonProperty("designer-tab") @JsonbProperty("designer-tab") List<RouteContribution> designerTab,
            @JsonProperty("landing-card") @JsonbProperty("landing-card") List<RouteContribution> landingCard,
            @JsonProperty("detail-panel") @JsonbProperty("detail-panel") List<RouteContribution> detailPanel,
            List<RouteContribution> action,
            @JsonProperty("search-provider") @JsonbProperty("search-provider") List<RouteContribution> searchProvider,
            List<RouteContribution> chat,
            @JsonProperty("decorator-views") @JsonbProperty("decorator-views") List<DecoratorView> decoratorViews
    ) {

        public static final Contributions NONE = new Contributions(null, null, null, null, null, null, null, null);

        /** The route-based extension points by their manifest name. Absent points are left out. */
        public Map<String, List<RouteContribution>> byRoutePoint() {
            Map<String, List<RouteContribution>> points = new TreeMap<>();
            putIfPresent(points, "screen", screen);
            putIfPresent(points, "designer-tab", designerTab);
            putIfPresent(points, "landing-card", landingCard);
            putIfPresent(points, "detail-panel", detailPanel);
            putIfPresent(points, "action", action);
            putIfPresent(points, "search-provider", searchProvider);
            putIfPresent(points, "chat", chat);
            return points;
        }

        Contributions withRoutes(Predicate<String> routeKept) {
            return new Contributions(keep(screen, routeKept), keep(designerTab, routeKept), keep(landingCard, routeKept),
                    keep(detailPanel, routeKept), keep(action, routeKept), keep(searchProvider, routeKept),
                    keep(chat, routeKept), decoratorViews);
        }

        private static List<RouteContribution> keep(List<RouteContribution> entries, Predicate<String> routeKept) {
            return entries == null ? null : entries.stream().filter(e -> routeKept.test(e.route())).toList();
        }

        private static void putIfPresent(Map<String, List<RouteContribution>> points, String point,
                                         List<RouteContribution> entries) {
            if (entries != null) {
                points.put(point, entries);
            }
        }
    }

    @RegisterForReflection
    @JsonbPropertyOrder({"id", "title", "route"})
    public record RouteContribution(String id, String title, String route) {}

    /** Hub draws this view from decorators, with no extension code. Shared with the overlay engine. */
    @RegisterForReflection
    @JsonbPropertyOrder({"id", "match", "label", "overlay"})
    public record DecoratorView(String id, Match match, String label, Overlay overlay) {}

    /** Exactly one of {@code type} or {@code schema} (a decorator {@code $schema} URL). */
    @RegisterForReflection
    @JsonbPropertyOrder({"type", "schema"})
    public record Match(String type, String schema) {}

    /** {@code status} and {@code label} are JSON Pointers into decorator data. Levels are ok, warn, error and info. */
    @RegisterForReflection
    @JsonbPropertyOrder({"status", "map", "defaultLevel", "label", "hide", "key", "time"})
    public record Overlay(
            String status,
            Map<String, String> map,
            @JsonProperty("default") @JsonbProperty("default") String defaultLevel,
            String label,
            List<String> hide,
            String key,
            String time
    ) {}
}
