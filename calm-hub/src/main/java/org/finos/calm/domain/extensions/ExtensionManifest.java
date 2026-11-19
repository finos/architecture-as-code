package org.finos.calm.domain.extensions;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import io.quarkus.runtime.annotations.RegisterForReflection;
import jakarta.json.bind.annotation.JsonbProperty;
import jakarta.json.bind.annotation.JsonbPropertyOrder;
import jakarta.json.bind.annotation.JsonbTransient;
import org.finos.calm.assets.ImageAsset;

import java.io.IOException;
import java.math.BigDecimal;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.function.Predicate;

/**
 * A validated {@code extension.json} (ADR 0012). The manifest JSON Schema in
 * {@code META-INF/calm-extensions/schema} is the contract; these records give code access to it.
 * {@code GET /api/calm/extensions} also returns them, so a null field is left out of the JSON.
 */
@RegisterForReflection
@JsonbPropertyOrder({"id", "version", "hubApi", "name", "description", "provider", "logo", "routes", "commands", "contributes"})
public record ExtensionManifest(
        String id,
        String version,
        int hubApi,
        String name,
        String description,
        String provider,
        Logo logo,
        List<Route> routes,
        Map<String, Command> commands,
        Contributions contributes
) {

    @JsonCreator
    public ExtensionManifest {
        routes = routes == null ? List.of() : List.copyOf(routes);
        // Sorted by name, so that the CLI and the MCP tool list have a stable order (ADR 0014).
        commands = commands == null ? Map.of() : Collections.unmodifiableMap(new TreeMap<>(commands));
        contributes = contributes == null ? Contributions.NONE : contributes;
    }

    public ExtensionManifest(String id, String version, int hubApi, String name, String description, String provider,
                             List<Route> routes, Map<String, Command> commands, Contributions contributes) {
        this(id, version, hubApi, name, description, provider, null, routes, commands, contributes);
    }

    /** A copy with this logo in place of the declared one. */
    public ExtensionManifest withLogo(Logo replacement) {
        return new ExtensionManifest(id, version, hubApi, name, description, provider, replacement, routes, commands,
                contributes);
    }

    public Optional<Route> route(String routeId) {
        return routes.stream().filter(r -> r.id().equals(routeId)).findFirst();
    }

    /**
     * The routes that only a dedicated Hub endpoint calls, such as the route of a form. The generic proxy and MCP
     * refuse them, so a caller cannot skip the checks of that endpoint.
     */
    public Set<String> dedicatedRoutes() {
        Set<String> ids = new HashSet<>();
        if (contributes.form() != null) {
            contributes.form().forEach(form -> ids.add(form.route()));
        }
        if (contributes.searchProvider() != null) {
            contributes.searchProvider().forEach(provider -> ids.add(provider.route()));
        }
        return ids;
    }

    public Optional<Form> form(String formId) {
        return contributes.form() == null ? Optional.empty()
                : contributes.form().stream().filter(f -> f.id().equals(formId)).findFirst();
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
        return new ExtensionManifest(id, version, hubApi, name, description, provider, logo, kept, keptCommands,
                contributes.withRoutes(routeKept));
    }

    /**
     * The files of the logo, next to {@code extension.json}: {@code light} for the light theme, and {@code dark}, if
     * set, for the dark theme. The registry leaves out the images; the UI reads each one from the logo endpoint.
     */
    @RegisterForReflection
    @JsonbPropertyOrder({"light", "dark"})
    public record Logo(
            String light,
            String dark,
            @JsonIgnore @JsonbTransient ImageAsset lightImage,
            @JsonIgnore @JsonbTransient ImageAsset darkImage
    ) {
        public static final String LIGHT = "light";
        public static final String DARK = "dark";

        public Logo withImages(ImageAsset light, ImageAsset dark) {
            return new Logo(this.light, this.dark, light, dark);
        }

        /** The image of a variant, {@code light} or {@code dark}. Empty when the manifest does not declare it. */
        public Optional<ImageAsset> image(String variant) {
            return Optional.ofNullable(DARK.equals(variant) ? darkImage : LIGHT.equals(variant) ? lightImage : null);
        }
    }

    @RegisterForReflection
    @JsonbPropertyOrder({"id", "method", "path", "scope", "readOnly", "hubData"})
    public record Route(String id, String method, String path, String scope, boolean readOnly, List<String> hubData) {

        /** The data that Hub reads and sends as the body of the route: the document, its links, conventions. */
        public static final String DOCUMENT = "document";
        public static final String DETAILED_ARCHITECTURES = "detailed-architectures";

        @JsonCreator
        public Route {
            hubData = hubData == null || hubData.isEmpty() ? null : List.copyOf(hubData);
        }

        public Route(String id, String method, String path, String scope, boolean readOnly) {
            this(id, method, path, scope, readOnly, null);
        }

        public boolean sendsHubData() {
            return hubData != null;
        }
    }

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
            "decoratorViews", "diagramLens", "form"})
    public record Contributions(
            List<RouteContribution> screen,
            @JsonProperty("designer-tab") @JsonbProperty("designer-tab") List<RouteContribution> designerTab,
            @JsonProperty("landing-card") @JsonbProperty("landing-card") List<RouteContribution> landingCard,
            @JsonProperty("detail-panel") @JsonbProperty("detail-panel") List<RouteContribution> detailPanel,
            List<RouteContribution> action,
            @JsonProperty("search-provider") @JsonbProperty("search-provider") List<RouteContribution> searchProvider,
            List<RouteContribution> chat,
            @JsonProperty("decorator-views") @JsonbProperty("decorator-views") List<DecoratorView> decoratorViews,
            @JsonProperty("diagram-lens") @JsonbProperty("diagram-lens") List<DiagramLens> diagramLens,
            List<Form> form
    ) {

        public static final Contributions NONE = new Contributions(null, null, null, null, null, null, null, null, null,
                null);

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

        /** A copy with these lenses in place of the declared ones. */
        public Contributions withDiagramLens(List<DiagramLens> lenses) {
            return new Contributions(screen, designerTab, landingCard, detailPanel, action, searchProvider, chat,
                    decoratorViews, lenses, form);
        }

        Contributions withRoutes(Predicate<String> routeKept) {
            return new Contributions(keep(screen, routeKept), keep(designerTab, routeKept), keep(landingCard, routeKept),
                    keep(detailPanel, routeKept), keep(action, routeKept), keep(searchProvider, routeKept),
                    keep(chat, routeKept), decoratorViews,
                    diagramLens == null ? null : diagramLens.stream().filter(l -> routeKept.test(l.route())).toList(),
                    form == null ? null : form.stream().filter(f -> routeKept.test(f.route())).toList());
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

    /**
     * Input that a {@code form} block collects and Hub sends to {@code route}, a POST, PUT or PATCH route that only
     * the form endpoint calls. {@code target} is the context that the form needs: {@code none}, {@code resource} or
     * {@code element}. Hub checks the input against {@code fields} before it calls the route.
     */
    @RegisterForReflection
    @JsonbPropertyOrder({"id", "title", "description", "route", "target", "submitLabel", "fields"})
    public record Form(String id, String title, String description, String route, String target, String submitLabel,
                       List<FormField> fields) {

        public static final String TARGET_NONE = "none";
        public static final String TARGET_RESOURCE = "resource";
        public static final String TARGET_ELEMENT = "element";

        public Form {
            target = target == null ? TARGET_NONE : target;
            fields = fields == null ? List.of() : List.copyOf(fields);
        }
    }

    /**
     * One labelled input of a form. {@code type} is {@code text}, {@code multiline}, {@code number}, {@code choice} or
     * {@code checkbox}. The loader checks that each rule suits the type.
     */
    @RegisterForReflection
    @JsonbPropertyOrder({"id", "type", "label", "help", "required", "defaultValue", "minLength", "maxLength", "minimum",
            "maximum", "integer", "options"})
    public record FormField(
            String id,
            String type,
            String label,
            String help,
            boolean required,
            @JsonProperty("default") @JsonbProperty("default") @JsonDeserialize(using = AsWritten.class) Object defaultValue,
            Integer minLength,
            Integer maxLength,
            BigDecimal minimum,
            BigDecimal maximum,
            Boolean integer,
            List<FormOption> options
    ) {
        /** Reads a decimal default as written, not as its nearest double, so that the form checks see the author's number. */
        @RegisterForReflection
        public static final class AsWritten extends JsonDeserializer<Object> {
            @Override
            public Object deserialize(JsonParser parser, DeserializationContext context) throws IOException {
                return parser.currentToken() == JsonToken.VALUE_NUMBER_FLOAT ? parser.getDecimalValue()
                        : context.readValue(parser, Object.class);
            }
        }
    }

    @RegisterForReflection
    @JsonbPropertyOrder({"value", "label"})
    public record FormOption(String value, String label) {}

    /** Hub draws this view from decorators, with no extension code. Shared with the overlay engine. */
    @RegisterForReflection
    @JsonbPropertyOrder({"id", "match", "label", "overlay"})
    public record DecoratorView(String id, Match match, String label, Overlay overlay) {}

    /**
     * Another picture of the architecture on the Diagram tab, chosen in its lens list (ADR 0013). Its route returns a
     * graph, and Hub draws it with the shapes and styles of the notation file, so no extension code reaches the browser.
     * The registry leaves out {@code notationContent}; the UI reads it from the lens notation endpoint when the lens opens.
     */
    @RegisterForReflection
    @JsonbPropertyOrder({"id", "title", "description", "route", "appliesTo", "params", "notation"})
    public record DiagramLens(
            String id,
            String title,
            String description,
            String route,
            AppliesTo appliesTo,
            Map<String, LensParam> params,
            String notation,
            @JsonIgnore @JsonbTransient Map<String, Object> notationContent
    ) {
        public DiagramLens {
            params = params == null ? Map.of() : Collections.unmodifiableMap(new java.util.LinkedHashMap<>(params));
        }

        public DiagramLens withNotationContent(Map<String, Object> content) {
            return new DiagramLens(id, title, description, route, appliesTo, params, notation, content);
        }
    }

    /** The resource types that a lens draws. Absent means every type that the Diagram tab shows. */
    @RegisterForReflection
    public record AppliesTo(List<String> resourceTypes) {}

    /** A view parameter of a lens: one of {@code values}, or a match of {@code pattern}. */
    @RegisterForReflection
    @JsonbPropertyOrder({"values", "pattern", "default"})
    public record LensParam(
            List<String> values,
            String pattern,
            @JsonProperty("default") @JsonbProperty("default") String defaultValue
    ) {}

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
