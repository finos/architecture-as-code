package org.finos.calm.extensions;

import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.json.schema.Draft;
import io.vertx.json.schema.JsonSchema;
import io.vertx.json.schema.JsonSchemaOptions;
import io.vertx.json.schema.OutputFormat;
import io.vertx.json.schema.Validator;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Checks the notation of a diagram lens: the JSON Schema, then what it cannot check. The UI draws each shape
 * from this data as SVG elements, so the checks keep a notation to geometry and colours (ADR 0013).
 */
public final class NotationChecker {

    /** Hub's own shapes and markers, which every notation can name. */
    public static final String CORE_PATH = "META-INF/calm-extensions/notations/core.json";
    static final String CORE = "core";
    /** A marker reference for no edge end. */
    public static final String NO_MARKER = "none";
    static final int MAX_NOTATION_BYTES = 262_144;
    static final int MAX_PATH_VALUE = 10_000;

    private static final String SCHEMA_PATH = "META-INF/calm-extensions/schema/0/notation.schema.json";
    private static final Pattern PATH_TOKEN = Pattern.compile(
            "\\s*,?\\s*(?:([MmLlHhVvCcSsQqTtAaZz])|([+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?))");
    private static final Map<Character, Integer> PATH_ARGS = Map.of('M', 2, 'L', 2, 'T', 2, 'H', 1, 'V', 1,
            'C', 6, 'S', 4, 'Q', 4, 'A', 7, 'Z', 0);

    /** The core notation never changes at run time, so all callers share one checker. */
    public static final NotationChecker SHARED = new NotationChecker();

    private final Validator validator;
    private final Map<String, Object> core;

    public NotationChecker() {
        ClassLoader classLoader = NotationChecker.class.getClassLoader();
        JsonObject schema = new JsonObject(read(classLoader, SCHEMA_PATH));
        validator = Validator.create(JsonSchema.of(schema), new JsonSchemaOptions()
                .setDraft(Draft.DRAFT202012)
                .setBaseUri(schema.getString("$id"))
                .setOutputFormat(OutputFormat.Basic));
        core = new JsonObject(read(classLoader, CORE_PATH)).getMap();
        List<String> problems = check(core);
        if (!problems.isEmpty()) {
            // A Hub defect: TestNotationCheckerShould catches it before a release.
            throw new IllegalStateException("The core notation: " + String.join("; ", problems));
        }
    }

    /** The problems with a notation, each starting with its location in the notation. Empty when it is valid. */
    public List<String> check(Map<String, Object> notation) {
        JsonObject json = new JsonObject(notation);
        if (json.encode().getBytes(StandardCharsets.UTF_8).length > MAX_NOTATION_BYTES) {
            return List.of("is larger than " + MAX_NOTATION_BYTES + " bytes");
        }
        List<String> problems = new ArrayList<>(ExtensionManifestLoader.schemaErrors(validator.validate(json)));
        if (!problems.isEmpty()) {
            return problems;
        }
        JsonObject shapes = orEmpty(json.getJsonObject("shapes"));
        JsonObject markers = orEmpty(json.getJsonObject("markers"));
        for (String name : shapes.fieldNames()) {
            checkShape("/shapes/" + name, shapes.getJsonObject(name), problems);
        }
        for (String name : markers.fieldNames()) {
            checkParts("/markers/" + name, markers.getJsonObject(name).getJsonArray("parts").getList(), problems);
        }
        JsonObject styles = orEmpty(json.getJsonObject("styles"));
        checkReferences(styles, "elements", "shape", "shapes", shapes, problems);
        checkReferences(styles, "groups", "shape", "shapes", shapes, problems);
        checkReferences(styles, "relationships", "start", "markers", markers, problems);
        checkReferences(styles, "relationships", "end", "markers", markers, problems);
        return problems;
    }

    private void checkShape(String where, JsonObject shape, List<String> problems) {
        double width = shape.getJsonArray("viewBox").getDouble(2);
        double height = shape.getJsonArray("viewBox").getDouble(3);
        JsonObject resize = shape.getJsonObject("resize");
        if (resize != null && resize.getJsonArray("insets") != null) {
            if (!"nine-slice".equals(resize.getString("mode"))) {
                problems.add(where + "/resize: insets are only for nine-slice");
            } else {
                List<Object> insets = resize.getJsonArray("insets").getList();
                if (number(insets.get(0)) + number(insets.get(2)) >= height || number(insets.get(1)) + number(insets.get(3)) >= width) {
                    problems.add(where + "/resize: the insets leave no middle to stretch");
                }
            }
        } else if (resize != null && "nine-slice".equals(resize.getString("mode"))) {
            problems.add(where + "/resize: nine-slice needs insets");
        }
        checkParts(where, shape.getJsonArray("parts").getList(), problems);
        JsonObject slots = orEmpty(shape.getJsonObject("slots"));
        int growing = 0;
        for (String name : slots.fieldNames()) {
            JsonObject slot = slots.getJsonObject(name);
            if (Boolean.TRUE.equals(slot.getBoolean("grow"))) {
                growing++;
            }
            if (slot.getDouble("x") < 0 || slot.getDouble("y") < 0
                    || slot.getDouble("x") + slot.getDouble("width") > width
                    || slot.getDouble("y") + slot.getDouble("height") > height) {
                problems.add(where + "/slots/" + name + ": is outside the viewBox");
            }
        }
        if (growing > 1) {
            problems.add(where + "/slots: only one slot can grow");
        }
        if (shape.getValue("ports") instanceof JsonArray ports) {
            Set<String> ids = new HashSet<>();
            for (Object port : ports) {
                String id = ((JsonObject) port).getString("id");
                if (!ids.add(id)) {
                    problems.add(where + "/ports: port '" + id + "' is declared more than once");
                }
            }
        }
    }

    private static void checkParts(String where, List<Object> parts, List<String> problems) {
        for (int i = 0; i < parts.size(); i++) {
            Object path = parts.get(i) instanceof Map<?, ?> map ? map.get("path") : ((JsonObject) parts.get(i)).getValue("path");
            String at = where + "/parts/" + i + "/path: ";
            if (path instanceof String data) {
                pathProblem(data).ifPresent(problem -> problems.add(at + problem));
            }
        }
    }

    /** A path holds only commands and numbers: no url(), no text. Each command has whole sets of arguments. */
    static Optional<String> pathProblem(String data) {
        Matcher matcher = PATH_TOKEN.matcher(data);
        int position = 0;
        Character command = null;
        int args = 0;
        boolean first = true;
        while (position < data.length()) {
            if (!matcher.find(position) || matcher.start() != position) {
                return data.substring(position).isBlank() ? endProblem(command, args)
                        : Optional.of("unexpected '" + data.charAt(Math.min(data.length() - 1, position + leadingSpace(data, position))) + "'");
            }
            position = matcher.end();
            if (matcher.group(1) != null) {
                Optional<String> end = endProblem(command, args);
                if (end.isPresent()) {
                    return end;
                }
                command = Character.toUpperCase(matcher.group(1).charAt(0));
                if (first && command != 'M') {
                    return Optional.of("must start with M");
                }
                first = false;
                args = 0;
            } else {
                if (command == null) {
                    return Optional.of("must start with M");
                }
                if (Math.abs(Double.parseDouble(matcher.group(2))) > MAX_PATH_VALUE) {
                    return Optional.of("has a number larger than " + MAX_PATH_VALUE);
                }
                args++;
            }
        }
        return command == null ? Optional.of("is empty") : endProblem(command, args);
    }

    private static int leadingSpace(String data, int position) {
        int skip = 0;
        while (position + skip < data.length() - 1 && (Character.isWhitespace(data.charAt(position + skip)) || data.charAt(position + skip) == ',')) {
            skip++;
        }
        return skip;
    }

    private static Optional<String> endProblem(Character command, int args) {
        if (command == null) {
            return Optional.empty();
        }
        int per = PATH_ARGS.get(command);
        boolean ok = per == 0 ? args == 0 : args > 0 && args % per == 0;
        return ok ? Optional.empty()
                : Optional.of("command " + command + " needs " + (per == 0 ? "no numbers" : "a multiple of " + per + " numbers")
                + ", but has " + args);
    }

    private void checkReferences(JsonObject styles, String list, String field, String kind, JsonObject own,
                                 List<String> problems) {
        JsonArray entries = styles.getJsonArray(list);
        if (entries == null) {
            return;
        }
        for (int i = 0; i < entries.size(); i++) {
            String reference = entries.getJsonObject(i).getString(field);
            if (reference != null && !resolves(reference, kind, own)) {
                problems.add("/styles/" + list + "/" + i + "/" + field + ": '" + reference + "' is not a "
                        + kind.substring(0, kind.length() - 1) + " of this notation or of the core notation");
            }
        }
    }

    // Each extension ships its own shapes. Hub adds only its core notation, which core/<name> names exactly.
    private boolean resolves(String reference, String kind, JsonObject own) {
        if ("markers".equals(kind) && NO_MARKER.equals(reference)) {
            return true;
        }
        String prefix = CORE + "/";
        if (reference.startsWith(prefix)) {
            return has(core, kind, reference.substring(prefix.length()));
        }
        return own.containsKey(reference) || has(core, kind, reference);
    }

    private static boolean has(Map<String, Object> library, String kind, String name) {
        return library != null && library.get(kind) instanceof Map<?, ?> entries && entries.containsKey(name);
    }

    private static JsonObject orEmpty(JsonObject json) {
        return json == null ? new JsonObject() : json;
    }

    private static double number(Object value) {
        return ((Number) value).doubleValue();
    }

    private static String read(ClassLoader classLoader, String name) {
        try (InputStream in = classLoader.getResourceAsStream(name)) {
            if (in == null) {
                throw new IllegalStateException("No classpath resource " + name);
            }
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot read classpath resource " + name, e);
        }
    }
}
