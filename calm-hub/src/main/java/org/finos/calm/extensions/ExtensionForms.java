package org.finos.calm.extensions;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.finos.calm.domain.extensions.ExtensionManifest;
import org.finos.calm.domain.extensions.ExtensionManifest.Form;
import org.finos.calm.domain.extensions.ExtensionManifest.FormField;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * The rules of a {@code form} contribution: the loader checks a manifest form with {@link #check}, and the form
 * endpoint checks the input of a submission with {@link #checkInput}. The UI has the same rules
 * ({@code calm-hub-ui/src/extensions/forms/formRules.ts}), so a user sees a field error before Hub does.
 */
public final class ExtensionForms {

    public static final Set<String> TYPES = Set.of("text", "multiline", "number", "choice", "checkbox");
    static final int TEXT_MAX_LENGTH = 1000;
    static final int MULTILINE_MAX_LENGTH = 10000;
    /** The context parameters that each target gives, so the route path can use them. */
    static final Map<String, List<String>> TARGET_PARAMS = Map.of(
            Form.TARGET_NONE, List.of(),
            Form.TARGET_RESOURCE, List.of("namespace", "resourceType", "resourceId", "version"),
            Form.TARGET_ELEMENT, List.of("namespace", "resourceType", "resourceId", "version", "selectedElement"));
    private static final Set<String> BODY_METHODS = Set.of("POST", "PUT", "PATCH");
    // Text takes no control character; multiline takes a tab and line breaks. A lone surrogate is never text.
    private static final Pattern TEXT_FORBIDDEN = Pattern.compile("[\\x00-\\x1f\\x7f]");
    private static final Pattern MULTILINE_FORBIDDEN = Pattern.compile("[\\x00-\\x08\\x0b\\x0c\\x0e-\\x1f\\x7f]");
    /** The largest whole number that JavaScript, and so the UI and many backends, holds exactly: 2^53 - 1. */
    static final BigDecimal MAX_SAFE_INTEGER = BigDecimal.valueOf(9007199254740991L);
    static final String SAFE_INTEGER_MESSAGE = "Enter a whole number from -" + MAX_SAFE_INTEGER + " to " + MAX_SAFE_INTEGER + ".";

    private ExtensionForms() {
    }

    /** Adds a problem for each form that the loader must refuse. */
    static void check(ExtensionManifest manifest, List<String> problems) {
        List<Form> forms = manifest.contributes().form();
        if (forms == null) {
            return;
        }
        Set<String> ids = new HashSet<>();
        for (Form form : forms) {
            String where = "form '" + form.id() + "'";
            if (!ids.add(form.id())) {
                problems.add(where + " is declared more than once");
            }
            manifest.route(form.route()).ifPresentOrElse(route -> {
                if (!BODY_METHODS.contains(route.method())) {
                    problems.add(where + " must name a POST, PUT or PATCH route, but route '" + route.id() + "' is "
                            + route.method());
                }
                if (route.sendsHubData()) {
                    problems.add(where + " names route '" + route.id() + "', which has hubData. Hub would replace the input");
                }
                List<String> params = TARGET_PARAMS.get(form.target());
                for (String param : ExtensionManifestLoader.pathParams(route.path())) {
                    if (!params.contains(param)) {
                        problems.add(where + " route '" + route.id() + "' has {" + param + "} in its path, which target '"
                                + form.target() + "' does not give. It gives " + params);
                    }
                }
            }, () -> problems.add(where + " names route '" + form.route() + "', which is not declared"));
            Set<String> fieldIds = new HashSet<>();
            for (FormField field : form.fields()) {
                if (!fieldIds.add(field.id())) {
                    problems.add(where + " field '" + field.id() + "' is declared more than once");
                }
                checkField(where + " field '" + field.id() + "'", field, problems);
            }
        }
    }

    private static void checkField(String where, FormField field, List<String> problems) {
        String type = field.type();
        boolean text = type.equals("text") || type.equals("multiline");
        boolean number = type.equals("number");
        boolean choice = type.equals("choice");
        notFor(where, type, "minLength", field.minLength() != null && !text, problems);
        notFor(where, type, "maxLength", field.maxLength() != null && !text, problems);
        notFor(where, type, "minimum", field.minimum() != null && !number, problems);
        notFor(where, type, "maximum", field.maximum() != null && !number, problems);
        notFor(where, type, "integer", field.integer() != null && !number, problems);
        notFor(where, type, "options", field.options() != null && !choice, problems);
        if (choice && field.options() == null) {
            problems.add(where + " is a choice, so it needs options");
        }
        if (choice && field.options() != null) {
            Set<String> values = new HashSet<>();
            field.options().forEach(option -> {
                if (!values.add(option.value())) {
                    problems.add(where + " has option value '" + option.value() + "' more than once");
                }
            });
        }
        if (text && field.minLength() != null && field.minLength() > maxLength(field)) {
            problems.add(where + " minLength is more than its maxLength");
        }
        if (number && field.minimum() != null && field.maximum() != null && field.minimum().compareTo(field.maximum()) > 0) {
            problems.add(where + " minimum is more than its maximum");
        }
        if (number) {
            checkLimit(where, "minimum", field.minimum(), Boolean.TRUE.equals(field.integer()), problems);
            checkLimit(where, "maximum", field.maximum(), Boolean.TRUE.equals(field.integer()), problems);
        }
        if (field.defaultValue() != null) {
            JsonNode value = toNode(field.defaultValue());
            String error = valueError(field, value);
            if (error != null) {
                problems.add(where + " default is not a valid value: " + error);
            } else if (number) {
                readAsWritten(where, "default", value.decimalValue(), problems);
            }
        }
    }

    private static void checkLimit(String where, String rule, BigDecimal limit, boolean integer, List<String> problems) {
        if (limit == null) {
            return;
        }
        if (integer && limit.abs().compareTo(MAX_SAFE_INTEGER) > 0) {
            problems.add(where + " takes whole numbers, so its " + rule + " must be from -" + MAX_SAFE_INTEGER + " to "
                    + MAX_SAFE_INTEGER);
        } else {
            readAsWritten(where, rule, limit, problems);
        }
    }

    /**
     * The UI reads a number as its nearest double and sends it as JavaScript writes that double. When that string is
     * another number, the UI and Hub would check a value against different numbers.
     */
    private static void readAsWritten(String where, String rule, BigDecimal number, List<String> problems) {
        double read = number.doubleValue();
        String javaScript = javaScriptString(read);
        if (!Double.isFinite(read) || new BigDecimal(javaScript).compareTo(number) != 0) {
            problems.add(where + " " + rule + " " + number + " reads in JavaScript as " + javaScript
                    + ", another number, so the UI and CALM Hub would check different numbers");
        }
    }

    /**
     * The string of {@code Number.prototype.toString()} and {@code JSON.stringify} for a finite number (ECMA-262
     * Number::toString): the fewest significant digits that read back as the double, the nearest such digits to it,
     * with an even last digit at a tie (as V8 does). {@link Double#toString} keeps at least two digits and so can choose
     * other digits for a subnormal: 4.9E-324 where JavaScript writes 5e-324.
     */
    static String javaScriptString(double value) {
        if (!Double.isFinite(value)) {
            return Double.isNaN(value) ? "NaN" : value > 0 ? "Infinity" : "-Infinity";
        }
        if (value == 0) {
            return "0";
        }
        BigDecimal exact = new BigDecimal(value);
        BigDecimal shortest = null;
        for (int precision = 1; shortest == null; precision++) {
            // The nearest decimals with this many digits below and above the value. Any that reads back is one of them.
            BigDecimal down = exact.round(new MathContext(precision, RoundingMode.DOWN));
            BigDecimal up = exact.round(new MathContext(precision, RoundingMode.UP));
            boolean downReads = down.doubleValue() == value;
            boolean upReads = up.doubleValue() == value;
            if (downReads && upReads) {
                int nearer = exact.subtract(down).abs().compareTo(up.subtract(exact).abs());
                shortest = nearer < 0 || (nearer == 0 && !down.unscaledValue().testBit(0)) ? down : up;
            } else if (downReads || upReads) {
                shortest = downReads ? down : up;
            }
        }
        shortest = shortest.stripTrailingZeros();
        String sign = shortest.signum() < 0 ? "-" : "";
        String digits = shortest.unscaledValue().abs().toString();
        int k = digits.length();
        int n = k - shortest.scale();
        if (k <= n && n <= 21) {
            return sign + digits + "0".repeat(n - k);
        }
        if (0 < n && n <= 21) {
            return sign + digits.substring(0, n) + "." + digits.substring(n);
        }
        if (-6 < n && n <= 0) {
            return sign + "0." + "0".repeat(-n) + digits;
        }
        String exponent = (n - 1 < 0 ? "e-" : "e+") + Math.abs(n - 1);
        return sign + digits.charAt(0) + (k == 1 ? "" : "." + digits.substring(1)) + exponent;
    }

    private static void notFor(String where, String type, String rule, boolean present, List<String> problems) {
        if (present) {
            problems.add(where + " is a " + type + " field, so it cannot have " + rule);
        }
    }

    private static JsonNode toNode(Object value) {
        return switch (value) {
            case String s -> JsonNodeFactory.instance.textNode(s);
            case Boolean b -> JsonNodeFactory.instance.booleanNode(b);
            case Number n -> JsonNodeFactory.instance.numberNode(new BigDecimal(n.toString()));
            default -> JsonNodeFactory.instance.nullNode();
        };
    }

    static int maxLength(FormField field) {
        int cap = field.type().equals("multiline") ? MULTILINE_MAX_LENGTH : TEXT_MAX_LENGTH;
        return field.maxLength() == null ? cap : Math.min(field.maxLength(), cap);
    }

    /**
     * Checks submitted input against the fields. Returns the input that Hub sends, with only the declared fields that
     * have a value, in field order. Puts a message for each field that fails in {@code errors}, keyed by field id, and
     * puts {@code ""} under {@code ""} when the input has a key that is not a field or is not an object.
     */
    public static ObjectNode checkInput(Form form, JsonNode input, Map<String, String> errors) {
        ObjectNode checked = JsonNodeFactory.instance.objectNode();
        if (input != null && !input.isNull() && !input.isObject()) {
            errors.put("", "The input must be a JSON object");
            return checked;
        }
        Map<String, FormField> fields = new LinkedHashMap<>();
        form.fields().forEach(field -> fields.put(field.id(), field));
        if (input != null) {
            for (Iterator<String> names = input.fieldNames(); names.hasNext(); ) {
                String name = names.next();
                if (!fields.containsKey(name)) {
                    errors.put("", "The input has a value that is not a field of this form");
                }
            }
        }
        for (FormField field : form.fields()) {
            JsonNode value = input == null ? null : input.get(field.id());
            boolean empty = value == null || value.isNull() || (value.isTextual() && value.asText().isEmpty());
            if (empty) {
                if (field.required()) {
                    errors.put(field.id(), requiredMessage(field));
                }
                continue;
            }
            boolean unset = value.isTextual() ? value.asText().isBlank() : value.isBoolean() && !value.asBoolean();
            String error = field.required() && unset ? requiredMessage(field) : valueError(field, value);
            if (error != null) {
                errors.put(field.id(), error);
            } else {
                checked.set(field.id(), value);
            }
        }
        return checked;
    }

    private static String requiredMessage(FormField field) {
        return switch (field.type()) {
            case "choice" -> "Choose an option.";
            case "checkbox" -> "Tick this box to continue.";
            default -> "Enter a value.";
        };
    }

    /** The message for a value that the field does not accept, or null when it accepts it. Leaves out {@code required}. */
    static String valueError(FormField field, JsonNode value) {
        return switch (field.type()) {
            case "text", "multiline" -> textError(field, value);
            case "number" -> numberError(field, value);
            case "choice" -> value.isTextual() && field.options() != null
                    && field.options().stream().anyMatch(option -> option.value().equals(value.asText()))
                    ? null : "Choose one of the options.";
            case "checkbox" -> value.isBoolean() ? null : "Tick the box or leave it clear.";
            default -> "This field type is not supported.";
        };
    }

    private static String textError(FormField field, JsonNode value) {
        if (!value.isTextual()) {
            return "Enter text.";
        }
        String text = value.asText();
        boolean multiline = field.type().equals("multiline");
        if ((multiline ? MULTILINE_FORBIDDEN : TEXT_FORBIDDEN).matcher(text).find() || !wellFormed(text)) {
            return multiline ? "Remove the control characters." : "Enter one line of text.";
        }
        int max = maxLength(field);
        if (text.length() > max) {
            return "Enter at most " + max + " characters.";
        }
        if (field.minLength() != null && text.length() < field.minLength()) {
            return "Enter at least " + field.minLength() + " characters.";
        }
        return null;
    }

    private static String numberError(FormField field, JsonNode value) {
        if (!value.isNumber()) {
            return "Enter a number.";
        }
        BigDecimal number = value.decimalValue();
        if (Boolean.TRUE.equals(field.integer()) && number.stripTrailingZeros().scale() > 0) {
            return "Enter a whole number.";
        }
        BigDecimal min = field.minimum();
        BigDecimal max = field.maximum();
        if ((min != null && number.compareTo(min) < 0) || (max != null && number.compareTo(max) > 0)) {
            return min != null && max != null ? "Enter a number from " + min.toPlainString() + " to " + max.toPlainString() + "."
                    : min != null ? "Enter " + min.toPlainString() + " or more." : "Enter " + max.toPlainString() + " or less.";
        }
        if (Boolean.TRUE.equals(field.integer()) && number.abs().compareTo(MAX_SAFE_INTEGER) > 0) {
            return SAFE_INTEGER_MESSAGE;
        }
        return null;
    }

    private static boolean wellFormed(String text) {
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (Character.isHighSurrogate(c)) {
                if (i + 1 >= text.length() || !Character.isLowSurrogate(text.charAt(i + 1))) {
                    return false;
                }
                i++;
            } else if (Character.isLowSurrogate(c)) {
                return false;
            }
        }
        return true;
    }
}
