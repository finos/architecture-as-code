package org.finos.calm.extensions;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import org.finos.calm.domain.extensions.ExtensionManifest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Consumer;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;

import static org.finos.calm.extensions.TestExtensionManifestLoaderShould.contribution;
import static org.finos.calm.extensions.TestExtensionManifestLoaderShould.route;
import static org.finos.calm.extensions.TestExtensionManifestLoaderShould.valid;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.anEmptyMap;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;

class TestExtensionFormsShould {

    private static final String ID = "team-services";
    private static final ObjectMapper JSON = new ObjectMapper();

    private final ExtensionManifestLoader loader = new ExtensionManifestLoader();

    static JsonObject reviewForm() {
        return new JsonObject()
                .put("id", "request-review")
                .put("title", "Request a review")
                .put("route", "request-review")
                .put("target", "resource")
                .put("fields", new JsonArray()
                        .add(new JsonObject().put("id", "reviewType").put("type", "choice").put("label", "Review type")
                                .put("required", true).put("default", "security")
                                .put("options", new JsonArray()
                                        .add(new JsonObject().put("value", "security").put("label", "Security"))
                                        .add(new JsonObject().put("value", "design").put("label", "Design"))))
                        .add(new JsonObject().put("id", "note").put("type", "multiline").put("label", "Note")
                                .put("required", true).put("minLength", 5).put("maxLength", 50))
                        .add(new JsonObject().put("id", "title").put("type", "text").put("label", "Title"))
                        .add(new JsonObject().put("id", "priority").put("type", "number").put("label", "Priority")
                                .put("minimum", 1).put("maximum", 5).put("integer", true).put("default", 3))
                        .add(new JsonObject().put("id", "confirm").put("type", "checkbox").put("label", "I checked the diagram")
                                .put("required", true).put("default", false)));
    }

    static JsonObject withForm(JsonObject form) {
        JsonObject manifest = valid();
        manifest.getJsonArray("routes").add(route("request-review", "POST", "/namespaces/{namespace}/reviews", "write"));
        manifest.getJsonObject("contributes").put("form", new JsonArray().add(form));
        return manifest;
    }

    private static JsonObject field(JsonObject manifest, int index) {
        return manifest.getJsonObject("contributes").getJsonArray("form").getJsonObject(0).getJsonArray("fields")
                .getJsonObject(index);
    }

    /** The priority field with no range, so that only the whole-number rules apply. */
    private static JsonObject unbounded(JsonObject field) {
        field.remove("minimum");
        field.remove("maximum");
        return field;
    }

    private static JsonObject form(JsonObject manifest) {
        return manifest.getJsonObject("contributes").getJsonArray("form").getJsonObject(0);
    }

    @Test
    void read_a_form_and_make_its_route_dedicated() {
        ExtensionManifest manifest = loader.parse(withForm(reviewForm()).encode(), ID, "test");

        ExtensionManifest.Form form = manifest.form("request-review").orElseThrow();
        assertThat(form.target(), is("resource"));
        assertThat(form.fields().stream().map(ExtensionManifest.FormField::type).toList(),
                contains("choice", "multiline", "text", "number", "checkbox"));
        assertThat(manifest.dedicatedRoutes(), contains("request-review"));
    }

    @Test
    void default_the_target_to_none() {
        JsonObject manifest = valid();
        manifest.getJsonArray("routes").add(route("feedback", "POST", "/feedback", "authenticated"));
        manifest.getJsonObject("contributes").put("form", new JsonArray().add(new JsonObject()
                .put("id", "feedback").put("title", "Feedback").put("route", "feedback")
                .put("fields", new JsonArray().add(new JsonObject().put("id", "text").put("type", "text").put("label", "Text")))));

        assertThat(loader.parse(manifest.encode(), ID, "test").form("feedback").orElseThrow().target(), is("none"));
    }

    static Stream<Arguments> invalidForms() {
        return Stream.of(
                invalid("a choice with no options", m -> field(m, 0).remove("options"), "field 'reviewType' is a choice, so it needs options"),
                invalid("a choice default that is not an option", m -> field(m, 0).put("default", "cost"),
                        "field 'reviewType' default is not a valid value: Choose one of the options."),
                invalid("an option value twice", m -> field(m, 0).getJsonArray("options").add(new JsonObject().put("value", "design").put("label", "Again")),
                        "field 'reviewType' has option value 'design' more than once"),
                invalid("a text field with options", m -> field(m, 2).put("options", field(m, 0).getJsonArray("options").copy()),
                        "field 'title' is a text field, so it cannot have options"),
                invalid("a number with a length", m -> field(m, 3).put("maxLength", 3), "field 'priority' is a number field, so it cannot have maxLength"),
                invalid("a minLength above the maxLength", m -> field(m, 1).put("minLength", 60), "field 'note' minLength is more than its maxLength"),
                invalid("a maxLength above the cap", m -> field(m, 1).put("maxLength", 20000), "/contributes/form/0/fields/1/maxLength"),
                invalid("a minimum above the maximum", m -> field(m, 3).put("minimum", 9), "field 'priority' minimum is more than its maximum"),
                invalid("a default out of range", m -> field(m, 3).put("default", 7), "field 'priority' default is not a valid value: Enter a number from 1 to 5."),
                invalid("a default that is not whole", m -> field(m, 3).put("default", 2.5), "field 'priority' default is not a valid value: Enter a whole number."),
                invalid("a whole-number maximum that JavaScript cannot hold exactly", m -> field(m, 3).put("maximum", 9007199254740992L),
                        "field 'priority' takes whole numbers, so its maximum must be from -9007199254740991 to 9007199254740991"),
                invalid("a whole-number minimum that JavaScript cannot hold exactly", m -> field(m, 3).put("minimum", -9007199254740992L),
                        "field 'priority' takes whole numbers, so its minimum must be from -9007199254740991 to 9007199254740991"),
                invalid("a whole-number default that JavaScript cannot hold exactly", m -> unbounded(field(m, 3)).put("default", 9007199254740993L),
                        "field 'priority' default is not a valid value: Enter a whole number from -9007199254740991 to 9007199254740991."),
                invalid("a checkbox default that is not a boolean", m -> field(m, 4).put("default", "yes"), "field 'confirm' default is not a valid value"),
                invalid("a field id twice", m -> field(m, 2).put("id", "note"), "field 'note' is declared more than once"),
                invalid("an unknown field type", m -> field(m, 2).put("type", "date"), "/contributes/form/0/fields/2/type"),
                invalid("no fields", m -> form(m).put("fields", new JsonArray()), "/contributes/form/0/fields"),
                invalid("a form id twice", m -> m.getJsonObject("contributes").getJsonArray("form").add(reviewForm()),
                        "form 'request-review' is declared more than once"),
                invalid("a route that is not declared", m -> form(m).put("route", "missing"), "form 'request-review' names route 'missing', which is not declared"),
                invalid("a GET route", m -> form(m).put("route", "screen"), "form 'request-review' must name a POST, PUT or PATCH route, but route 'screen' is GET"),
                invalid("a path parameter that the target does not give", m -> form(m).put("target", "none"),
                        "form 'request-review' route 'request-review' has {namespace} in its path, which target 'none' does not give"),
                invalid("an action on the form route", m -> m.getJsonObject("contributes").getJsonArray("action").add(contribution("review", "request-review")),
                        "route 'request-review' is named by action 'review', form 'request-review'. Only CALM Hub calls this route, through "
                                + "the endpoint of one entry, so no other entry or command may name it"),
                invalid("a command on the form route", m -> m.getJsonObject("commands").put("review", new JsonObject()
                                .put("route", "request-review").put("description", "Review")
                                .put("input", new JsonObject().put("type", "object")
                                        .put("properties", new JsonObject().put("namespace", new JsonObject().put("type", "string")))
                                        .put("required", new JsonArray().add("namespace")))),
                        "route 'request-review' is named by command 'review', form 'request-review'")
        );
    }

    private static Arguments invalid(String name, Consumer<JsonObject> change, String expected) {
        return Arguments.of(name, change, expected);
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("invalidForms")
    void reject_a_form_with(String name, Consumer<JsonObject> change, String expected) {
        JsonObject manifest = withForm(reviewForm());
        change.accept(manifest);

        IllegalStateException e = assertThrows(IllegalStateException.class, () -> loader.parse(manifest.encode(), ID, "test"));

        assertThat(e.getMessage(), containsString(expected));
    }

    private ExtensionManifest.Form parsedForm() {
        return loader.parse(withForm(reviewForm()).encode(), ID, "test").form("request-review").orElseThrow();
    }

    private Map<String, String> errors(String input) throws Exception {
        Map<String, String> errors = new LinkedHashMap<>();
        ExtensionForms.checkInput(parsedForm(), JSON.readTree(input), errors);
        return errors;
    }

    @Test
    void keep_only_the_declared_fields_with_a_value_in_field_order() throws Exception {
        Map<String, String> errors = new LinkedHashMap<>();
        JsonNode input = JSON.readTree("{\"confirm\":true,\"note\":\"Check the ledger\",\"title\":\"\",\"reviewType\":\"design\","
                + "\"priority\":2.0}");

        ObjectNode checked = ExtensionForms.checkInput(parsedForm(), input, errors);

        assertThat(errors, is(anEmptyMap()));
        assertThat(checked.toString(), equalTo("{\"reviewType\":\"design\",\"note\":\"Check the ledger\",\"priority\":2.0,\"confirm\":true}"));
    }

    @Test
    void give_a_message_for_each_field_that_fails() throws Exception {
        assertThat(errors("{\"reviewType\":\"cost\",\"note\":\"   \",\"title\":\"a\\nb\",\"priority\":2.5,\"confirm\":false}"),
                equalTo(Map.of(
                        "reviewType", "Choose one of the options.",
                        "note", "Enter a value.",
                        "title", "Enter one line of text.",
                        "priority", "Enter a whole number.",
                        "confirm", "Tick this box to continue.")));
        assertThat(errors("{\"note\":\"tiny\",\"priority\":\"3\",\"confirm\":\"true\"}"),
                equalTo(Map.of(
                        "reviewType", "Choose an option.",
                        "note", "Enter at least 5 characters.",
                        "priority", "Enter a number.",
                        "confirm", "Tick the box or leave it clear.")));
        assertThat(errors("{\"reviewType\":\"design\",\"note\":\"" + "x".repeat(51) + "\",\"priority\":6,\"confirm\":true}"),
                equalTo(Map.of("note", "Enter at most 50 characters.", "priority", "Enter a number from 1 to 5.")));
    }

    @Test
    void accept_whole_number_limits_and_defaults_up_to_the_largest_that_javascript_holds_exactly() {
        JsonObject manifest = withForm(reviewForm());
        field(manifest, 3).put("minimum", -9007199254740991L).put("maximum", 9007199254740991L).put("default", 9007199254740991L);
        // Only a whole-number field has the limit: another number field is a double in JavaScript too.
        field(manifest, 2).put("type", "number").put("maximum", 1e20).put("default", 1e19);

        ExtensionManifest.FormField priority = loader.parse(manifest.encode(), ID, "test").form("request-review").orElseThrow()
                .fields().get(3);

        assertThat(priority.maximum().toPlainString(), is("9007199254740991"));
        assertThat(priority.minimum().toPlainString(), is("-9007199254740991"));
    }

    /** The priority field with one number rule, written into the manifest text as it is: a JsonObject would hold a double. */
    private ExtensionManifest.FormField priorityWith(boolean integer, String rule, String literal) {
        JsonObject manifest = withForm(reviewForm());
        JsonObject priority = unbounded(field(manifest, 3));
        priority.remove("default");
        if (!integer) {
            priority.remove("integer");
        }
        priority.put(rule, "LITERAL");
        String json = manifest.encode().replace("\"LITERAL\"", literal);
        return loader.parse(json, ID, "test").form("request-review").orElseThrow().fields().get(3);
    }

    @ParameterizedTest(name = "{1} {2}, whole numbers only {0}")
    @CsvSource({
            "true, default, 2.0",
            "true, default, 9007199254740991",
            "true, default, -9007199254740991.0",
            "true, minimum, -9007199254740991",
            "true, maximum, 9007199254740991.0",
            "true, minimum, 2.5"
    })
    void read_a_number_rule_as_written(boolean integer, String rule, String literal) {
        assertThat(ruleValue(priorityWith(integer, rule, literal), rule).compareTo(new BigDecimal(literal)), is(0));
    }

    private static BigDecimal ruleValue(ExtensionManifest.FormField field, String rule) {
        Object value = switch (rule) {
            case "minimum" -> field.minimum();
            case "maximum" -> field.maximum();
            default -> field.defaultValue();
        };
        return new BigDecimal(value.toString());
    }

    static Stream<Arguments> javaScriptNumbers() throws IOException {
        JsonNode file = JSON.readTree(Files.readString(Path.of("src/test/resources/extensions-test/javascript-numbers.json")));
        return StreamSupport.stream(file.get("cases").spliterator(), false)
                .map(entry -> Arguments.of(entry.get("literal").asText(), entry.get("javascript").asText()));
    }

    // formRules.test.ts checks each string against the JavaScript that runs the UI tests.
    @ParameterizedTest(name = "{0} is {1} in JavaScript")
    @MethodSource("javaScriptNumbers")
    void take_a_number_rule_only_when_javascript_reads_the_same_number(String literal, String javascript) {
        assertThat(ExtensionForms.javaScriptString(new BigDecimal(literal).doubleValue()), is(javascript));

        boolean same = !javascript.endsWith("Infinity") && new BigDecimal(javascript).compareTo(new BigDecimal(literal)) == 0;
        for (String rule : new String[]{"minimum", "maximum", "default"}) {
            if (same) {
                assertThat(rule, ruleValue(priorityWith(false, rule, literal), rule).compareTo(new BigDecimal(literal)), is(0));
            } else {
                IllegalStateException e = assertThrows(IllegalStateException.class, () -> priorityWith(false, rule, literal));
                assertThat(e.getMessage(), containsString("field 'priority' " + rule + " " + new BigDecimal(literal)
                        + " reads in JavaScript as " + javascript + ", another number, so the UI and CALM Hub would check different numbers"));
            }
        }
    }

    @ParameterizedTest(name = "{1} {2}, whole numbers only {0}")
    @CsvSource(delimiter = '|', value = {
            "true  | default | 5.0000000000000001   | default is not a valid value: Enter a whole number.",
            "true  | default | 9007199254740991.1   | default is not a valid value: Enter a whole number.",
            "true  | default | -9007199254740991.1  | default is not a valid value: Enter a whole number.",
            "true  | minimum | 9007199254740991.1   | takes whole numbers, so its minimum must be from -9007199254740991 to 9007199254740991",
            "true  | minimum | -9007199254740991.1  | takes whole numbers, so its minimum must be from -9007199254740991 to 9007199254740991",
            "true  | maximum | 9007199254740991.1   | takes whole numbers, so its maximum must be from -9007199254740991 to 9007199254740991",
            "true  | maximum | -9007199254740991.1  | takes whole numbers, so its maximum must be from -9007199254740991 to 9007199254740991",
            "true  | minimum | 5.0000000000000001   | minimum 5.0000000000000001 reads in JavaScript as 5, another number",
            "true  | maximum | -5.0000000000000001  | maximum -5.0000000000000001 reads in JavaScript as -5, another number",
            "true  | maximum | 4.9e-324             | maximum 4.9E-324 reads in JavaScript as 5e-324, another number"
    })
    void refuse_a_number_rule_that_javascript_reads_as_another_number(boolean integer, String rule, String literal, String expected) {
        IllegalStateException e = assertThrows(IllegalStateException.class, () -> priorityWith(integer, rule, literal));

        assertThat(e.getMessage(), containsString("field 'priority' " + expected));
    }

    @Test
    void refuse_a_whole_number_input_that_javascript_cannot_hold_exactly() throws Exception {
        JsonObject manifest = withForm(reviewForm());
        unbounded(field(manifest, 3));
        ExtensionManifest.Form form = loader.parse(manifest.encode(), ID, "test").form("request-review").orElseThrow();
        String valid = "{\"reviewType\":\"design\",\"note\":\"Check it\",\"confirm\":true,\"priority\":";

        for (String value : new String[]{"9007199254740993", "-9007199254740993", "9007199254740992", "-9007199254740992", "1e16"}) {
            Map<String, String> errors = new LinkedHashMap<>();
            ExtensionForms.checkInput(form, JSON.readTree(valid + value + "}"), errors);
            assertThat(value, errors, equalTo(Map.of("priority", "Enter a whole number from -9007199254740991 to 9007199254740991.")));
        }
        for (String value : new String[]{"9007199254740991", "-9007199254740991"}) {
            Map<String, String> errors = new LinkedHashMap<>();
            ObjectNode checked = ExtensionForms.checkInput(form, JSON.readTree(valid + value + "}"), errors);
            assertThat(value, errors, is(anEmptyMap()));
            assertThat(checked.get("priority").toString(), is(value));
        }
    }

    static Stream<Arguments> sharedCases() throws IOException {
        JsonNode file = JSON.readTree(Files.readString(Path.of("src/test/resources/extensions-test/form-input.json")));
        ExtensionManifest.Form form = new ExtensionManifestLoader()
                .parse(withForm(new JsonObject(file.get("form").toString())).encode(), ID, "test").form("request-review").orElseThrow();
        return StreamSupport.stream(file.get("cases").spliterator(), false)
                .map(entry -> Arguments.of(entry.get("name").asText(), form, entry.get("input"),
                        JSON.convertValue(entry.get("errors"), Map.class)));
    }

    // The UI shows the same messages: formRules.test.ts reads the same cases.
    @ParameterizedTest(name = "{0}")
    @MethodSource("sharedCases")
    void check_the_input_rules_that_the_ui_shares(String name, ExtensionManifest.Form form, JsonNode input, Map<String, String> expected) {
        Map<String, String> errors = new LinkedHashMap<>();
        ExtensionForms.checkInput(form, input, errors);
        assertThat(errors, equalTo(expected));
    }

    @Test
    void accept_line_breaks_only_in_multiline_text_and_refuse_a_lone_surrogate() throws Exception {
        assertThat(errors("{\"reviewType\":\"design\",\"note\":\"Line one\\r\\nLine\\ttwo\",\"confirm\":true}"), is(anEmptyMap()));
        assertThat(errors("{\"reviewType\":\"design\",\"note\":\"Bad \\ud800 text\",\"confirm\":true}"),
                equalTo(Map.of("note", "Remove the control characters.")));
        assertThat(errors("{\"reviewType\":\"design\",\"note\":\"Bell \\u0007 here\",\"confirm\":true}"),
                equalTo(Map.of("note", "Remove the control characters.")));
    }

    @Test
    void refuse_a_value_that_no_field_takes_and_input_that_is_not_an_object() throws Exception {
        assertThat(errors("{\"reviewType\":\"design\",\"note\":\"Check it\",\"confirm\":true,\"namespace\":\"other\"}"),
                equalTo(Map.of("", "The input has a value that is not a field of this form")));
        assertThat(errors("[]"), equalTo(Map.of("", "The input must be a JSON object")));
    }
}
