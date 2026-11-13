package org.finos.calm.mcp.tools;

import io.quarkiverse.mcp.server.ToolResponse;
import io.quarkus.security.identity.SecurityIdentity;
import org.finos.calm.config.DecoratorConfig;
import org.finos.calm.domain.Decorator;
import org.finos.calm.domain.DecoratorHistoryEntry;
import org.finos.calm.domain.DecoratorSchemaError;
import org.finos.calm.domain.SchemaValidationLimits;
import org.finos.calm.domain.exception.DecoratorKeyRefusedException;
import org.finos.calm.domain.exception.DecoratorNotFoundException;
import org.finos.calm.domain.exception.DecoratorSupersededException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.StorageWriteException;
import org.finos.calm.services.DecoratorSchemaValidator;
import org.finos.calm.services.DecoratorWriteService;
import org.finos.calm.store.DecoratorStore;
import org.finos.calm.testutil.LogCapture;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.security.Principal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.logging.Level;
import java.util.stream.IntStream;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.allOf;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.startsWith;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestDecoratorToolsShould {

    @Mock
    DecoratorStore decoratorStore;

    @Mock
    DecoratorConfig mockConfig;

    @Mock
    DecoratorSchemaValidator mockSchemaValidator;

    @InjectMocks
    DecoratorTools decoratorTools;

    @BeforeEach
    void setup() {
        decoratorTools.mcpEnabled = true;
        decoratorTools.allowPutOperations = true;
        DecoratorConfig.ReservedType reserved = () -> List.of("policy-engine");
        lenient().when(mockConfig.reserved()).thenReturn(Map.of("control-evaluation", reserved));
        lenient().when(mockSchemaValidator.validate(any())).thenReturn(List.of());
        decoratorTools.decoratorWriteService = new DecoratorWriteService(decoratorStore, mockConfig, mockSchemaValidator);
    }

    private static String text(ToolResponse r) {
        return r.firstContent().asText().text();
    }

    // --- listDecorators ---

    @Test
    void return_decorators_for_namespace() throws NamespaceNotFoundException {
        Decorator dec = new Decorator.DecoratorBuilder()
                .setUniqueId("test-decorator")
                .setType("threat-model")
                .setTarget(List.of("/calm/namespaces/workshop/architectures/1/versions/1-0-0"))
                .build();

        when(decoratorStore.getDecoratorValuesForNamespace("workshop", null, "threat-model"))
                .thenReturn(List.of(dec));

        String result = text(decoratorTools.listDecorators("workshop", "", "threat-model"));

        assertThat(result, containsString("test-decorator"));
        assertThat(result, containsString("threat-model"));
    }

    @Test
    void return_decorators_with_both_filters() throws NamespaceNotFoundException {
        Decorator dec = new Decorator.DecoratorBuilder()
                .setUniqueId("filtered-dec")
                .setType("deployment")
                .setTarget(List.of("/calm/ns/1"))
                .build();

        when(decoratorStore.getDecoratorValuesForNamespace("workshop", "/calm/ns/1", "deployment"))
                .thenReturn(List.of(dec));

        String result = text(decoratorTools.listDecorators("workshop", "/calm/ns/1", "deployment"));

        assertThat(result, containsString("filtered-dec"));
    }

    @Test
    void return_no_decorators_message_when_empty() throws NamespaceNotFoundException {
        when(decoratorStore.getDecoratorValuesForNamespace("workshop", null, null))
                .thenReturn(List.of());

        String result = text(decoratorTools.listDecorators("workshop", "", ""));

        assertThat(result, containsString("No decorators found"));
    }

    @Test
    void return_no_decorators_message_with_type_filter() throws NamespaceNotFoundException {
        when(decoratorStore.getDecoratorValuesForNamespace("workshop", null, "deployment"))
                .thenReturn(List.of());

        String result = text(decoratorTools.listDecorators("workshop", null, "deployment"));

        assertThat(result, containsString("No decorators found"));
        assertThat(result, containsString("deployment"));
    }

    @Test
    void return_decorators_with_target_filter_only() throws NamespaceNotFoundException {
        Decorator dec = new Decorator.DecoratorBuilder()
                .setUniqueId("target-filtered-dec")
                .setType("threat-model")
                .setTarget(List.of("/calm/ns/1"))
                .build();

        when(decoratorStore.getDecoratorValuesForNamespace("workshop", "/calm/ns/1", null))
                .thenReturn(List.of(dec));

        String result = text(decoratorTools.listDecorators("workshop", "/calm/ns/1", ""));

        assertThat(result, containsString("target-filtered-dec"));
    }

    @Test
    void return_error_for_missing_namespace() throws NamespaceNotFoundException {
        when(decoratorStore.getDecoratorValuesForNamespace("missing", null, null))
                .thenThrow(new NamespaceNotFoundException());

        ToolResponse response = decoratorTools.listDecorators("missing", "", "");

        assertThat(response.isError(), is(true));
        assertThat(text(response), startsWith("Error:"));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   ", "bad namespace"})
    void reject_invalid_namespace_for_list_decorators(String namespace) {
        ToolResponse response = decoratorTools.listDecorators(namespace, null, null);

        assertThat(response.isError(), is(true));
        assertThat(text(response), startsWith("Error:"));
        verifyNoInteractions(decoratorStore);
    }

    @ParameterizedTest
    @ValueSource(strings = {" /calm/foo", "/calm/foo bar", "/calm/foo\n"})
    void reject_target_filter_with_whitespace(String target) {
        ToolResponse response = decoratorTools.listDecorators("workshop", target, null);

        assertThat(response.isError(), is(true));
        assertThat(text(response), startsWith("Error:"));
        assertThat(text(response), containsString("Target filter"));
        verifyNoInteractions(decoratorStore);
    }

    @ParameterizedTest
    @ValueSource(strings = {"deployment type", "threat model\t", "bad type!"})
    void reject_type_filter_with_whitespace_or_illegal_chars(String type) {
        ToolResponse response = decoratorTools.listDecorators("workshop", null, type);

        assertThat(response.isError(), is(true));
        assertThat(text(response), startsWith("Error:"));
        assertThat(text(response), containsString("Type filter"));
        verifyNoInteractions(decoratorStore);
    }

    @Test
    void reject_target_filter_exceeding_max_length() {
        String longTarget = "/calm/" + "a".repeat(500);
        ToolResponse response = decoratorTools.listDecorators("workshop", longTarget, null);

        assertThat(response.isError(), is(true));
        assertThat(text(response), containsString("Target filter"));
        verifyNoInteractions(decoratorStore);
    }

    // --- getDecorator ---

    @Test
    void return_decorator_by_id() throws Exception {
        Decorator dec = new Decorator.DecoratorBuilder()
                .setUniqueId("threat-model-1")
                .setType("threat-model")
                .setTarget(List.of("/calm/ns/1"))
                .setTargetType(List.of("architecture"))
                .setAppliesTo(List.of("node-1"))
                .setData("test-data")
                .build();

        when(decoratorStore.getDecoratorById("workshop", 1))
                .thenReturn(Optional.of(dec));

        String result = text(decoratorTools.getDecorator("workshop", 1));

        assertThat(result, containsString("threat-model-1"));
        assertThat(result, containsString("threat-model"));
    }

    @Test
    void return_not_found_when_decorator_optional_empty() throws Exception {
        when(decoratorStore.getDecoratorById("workshop", 99))
                .thenReturn(Optional.empty());

        String result = text(decoratorTools.getDecorator("workshop", 99));

        assertThat(result, containsString("not found"));
    }

    @Test
    void return_error_when_namespace_not_found_for_get_decorator() throws Exception {
        when(decoratorStore.getDecoratorById("missing", 1))
                .thenThrow(new NamespaceNotFoundException());

        ToolResponse response = decoratorTools.getDecorator("missing", 1);

        assertThat(response.isError(), is(true));
        assertThat(text(response), containsString("Namespace"));
    }

    @Test
    void reject_invalid_namespace_for_get_decorator() {
        ToolResponse response = decoratorTools.getDecorator("bad ns", 1);

        assertThat(response.isError(), is(true));
        assertThat(text(response), startsWith("Error:"));
        verifyNoInteractions(decoratorStore);
    }

    // --- createDecorator ---

    @Test
    void create_decorator_successfully() throws NamespaceNotFoundException {
        when(decoratorStore.createDecorator(eq("workshop"), anyString()))
                .thenReturn(5);

        String result = text(decoratorTools.createDecorator("workshop", "{\"type\":\"threat-model\"}"));

        assertThat(result, containsString("created successfully"));
        assertThat(result, containsString("5"));
    }

    @Test
    void return_error_when_creating_in_missing_namespace() throws NamespaceNotFoundException {
        when(decoratorStore.createDecorator(eq("missing"), anyString()))
                .thenThrow(new NamespaceNotFoundException());

        ToolResponse response = decoratorTools.createDecorator("missing", "{\"type\":\"test\"}");

        assertThat(response.isError(), is(true));
        assertThat(text(response), startsWith("Error:"));
    }

    @Test
    void reject_invalid_namespace_for_create_decorator() {
        ToolResponse response = decoratorTools.createDecorator("bad ns", "{\"type\":\"test\"}");

        assertThat(response.isError(), is(true));
        assertThat(text(response), startsWith("Error:"));
        verifyNoInteractions(decoratorStore);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   "})
    void reject_blank_json_for_create_decorator(String json) {
        ToolResponse response = decoratorTools.createDecorator("workshop", json);

        assertThat(response.isError(), is(true));
        assertThat(text(response), containsString("Decorator JSON"));
        verifyNoInteractions(decoratorStore);
    }

    // --- updateDecorator ---

    @Test
    void update_decorator_successfully() throws Exception {
        String result = text(decoratorTools.updateDecorator("workshop", 1, "{\"updated\":true}"));

        assertThat(result, containsString("updated successfully"));
    }

    @Test
    void return_error_when_updating_nonexistent_decorator() throws Exception {
        org.mockito.Mockito.doThrow(new DecoratorNotFoundException())
                .when(decoratorStore).updateDecorator(eq("workshop"), eq(99), anyString());

        ToolResponse response = decoratorTools.updateDecorator("workshop", 99, "{\"type\":\"test\"}");

        assertThat(response.isError(), is(true));
        assertThat(text(response), startsWith("Error:"));
    }

    @Test
    void return_error_when_updating_in_missing_namespace() throws Exception {
        org.mockito.Mockito.doThrow(new NamespaceNotFoundException())
                .when(decoratorStore).updateDecorator(eq("missing"), eq(1), anyString());

        ToolResponse response = decoratorTools.updateDecorator("missing", 1, "{\"type\":\"test\"}");

        assertThat(response.isError(), is(true));
        assertThat(text(response), containsString("Namespace"));
    }

    @Test
    void reject_invalid_namespace_for_update_decorator() {
        ToolResponse response = decoratorTools.updateDecorator("bad ns", 1, "{\"type\":\"test\"}");

        assertThat(response.isError(), is(true));
        assertThat(text(response), startsWith("Error:"));
        verifyNoInteractions(decoratorStore);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   "})
    void reject_blank_json_for_update_decorator(String json) {
        ToolResponse response = decoratorTools.updateDecorator("workshop", 1, json);

        assertThat(response.isError(), is(true));
        assertThat(text(response), containsString("Decorator JSON"));
        verifyNoInteractions(decoratorStore);
    }

    @ParameterizedTest
    @ValueSource(ints = {0, -1, -42})
    void reject_non_positive_id_for_get_decorator(int id) {
        ToolResponse response = decoratorTools.getDecorator("workshop", id);

        assertThat(response.isError(), is(true));
        assertThat(text(response), containsString("Decorator ID"));
        verifyNoInteractions(decoratorStore);
    }

    @ParameterizedTest
    @ValueSource(ints = {0, -1, -42})
    void reject_non_positive_id_for_update_decorator(int id) {
        ToolResponse response = decoratorTools.updateDecorator("workshop", id, "{\"type\":\"test\"}");

        assertThat(response.isError(), is(true));
        assertThat(text(response), containsString("Decorator ID"));
        verifyNoInteractions(decoratorStore);
    }

    @Test
    void reject_invalid_json_for_create_decorator() {
        ToolResponse response = decoratorTools.createDecorator("workshop", "not-json");

        assertThat(response.isError(), is(true));
        assertThat(text(response), containsString("Decorator JSON"));
        verifyNoInteractions(decoratorStore);
    }

    @Test
    void reject_invalid_json_for_update_decorator() {
        ToolResponse response = decoratorTools.updateDecorator("workshop", 1, "not-json");

        assertThat(response.isError(), is(true));
        assertThat(text(response), containsString("Decorator JSON"));
        verifyNoInteractions(decoratorStore);
    }

    @Test
    void return_updated_representation_when_update_succeeds() throws Exception {
        Decorator updated = new Decorator.DecoratorBuilder()
                .setUniqueId("updated-decorator")
                .setType("threat-model")
                .setTarget(List.of("/calm/ns/1"))
                .setData("updated-data")
                .build();

        when(decoratorStore.getDecoratorById("workshop", 1)).thenReturn(Optional.of(updated));

        String result = text(decoratorTools.updateDecorator("workshop", 1, "{\"updated\":true}"));

        assertThat(result, containsString("updated successfully"));
        assertThat(result, containsString("updated-decorator"));
        assertThat(result, containsString("threat-model"));
        assertThat(result, containsString("updated-data"));
    }

    @Test
    void return_error_when_the_store_cannot_keep_a_key_on_create() throws Exception {
        when(decoratorStore.createDecorator(eq("workshop"), anyString())).thenThrow(DecoratorKeyRefusedException.nulCharacter());

        ToolResponse response = decoratorTools.createDecorator("workshop", "{\"type\":\"test\"}");

        assertThat(response.isError(), is(true));
        assertThat(text(response), is("Error: " + DecoratorKeyRefusedException.nulCharacter().getMessage() + "."));
    }

    @Test
    void return_error_when_the_store_cannot_keep_a_key_on_update() throws Exception {
        org.mockito.Mockito.doThrow(DecoratorKeyRefusedException.idWithAnotherValue())
                .when(decoratorStore).updateDecorator(eq("workshop"), eq(1), anyString());

        ToolResponse response = decoratorTools.updateDecorator("workshop", 1, "{\"type\":\"test\"}");

        assertThat(response.isError(), is(true));
        assertThat(text(response), is("Error: " + DecoratorKeyRefusedException.idWithAnotherValue().getMessage() + "."));
    }

    @Test
    void return_error_when_a_decorator_has_more_characters_than_the_size_limit() {
        String json = "{\"data\": \"" + "x".repeat(SchemaValidationLimits.MAX_DECORATOR_JSON_BYTES) + "\"}";

        ToolResponse response = decoratorTools.createDecorator("workshop", json);

        assertThat(response.isError(), is(true));
        assertThat(text(response), is("Error: Decorator JSON must not exceed " + SchemaValidationLimits.MAX_DECORATOR_JSON_BYTES + " bytes."));
        verifyNoInteractions(decoratorStore);
    }

    @Test
    void return_error_when_a_decorator_has_more_utf8_bytes_than_the_size_limit() {
        String json = "{\"data\": \"" + "é".repeat(SchemaValidationLimits.MAX_DECORATOR_JSON_BYTES / 2) + "\"}";

        ToolResponse create = decoratorTools.createDecorator("workshop", json);
        ToolResponse update = decoratorTools.updateDecorator("workshop", 1, json);

        assertThat(text(create), is("Error: Decorator JSON must not exceed " + SchemaValidationLimits.MAX_DECORATOR_JSON_BYTES + " bytes."));
        assertThat(text(update), is(text(create)));
        verifyNoInteractions(decoratorStore);
    }

    @Test
    void refuse_a_multibyte_decorator_over_the_size_limit_before_it_is_parsed() {
        // Under the limit in characters but over it in bytes, and not JSON: a parse first would say "not valid JSON".
        String notJson = "é".repeat(SchemaValidationLimits.MAX_DECORATOR_JSON_BYTES / 2 + 1);

        ToolResponse create = decoratorTools.createDecorator("workshop", notJson);
        ToolResponse update = decoratorTools.updateDecorator("workshop", 1, notJson);

        assertThat(text(create), is("Error: Decorator JSON must not exceed " + SchemaValidationLimits.MAX_DECORATOR_JSON_BYTES + " bytes."));
        assertThat(text(update), is(text(create)));
        verifyNoInteractions(decoratorStore);
    }

    @Test
    void accept_a_multibyte_decorator_at_the_size_limit() throws Exception {
        String prefix = "{\"type\":\"test\",\"data\":\"";
        String suffix = "\"}";
        int room = SchemaValidationLimits.MAX_DECORATOR_JSON_BYTES - prefix.length() - suffix.length();
        String json = prefix + "é".repeat(room / 2) + "x".repeat(room % 2) + suffix;
        when(decoratorStore.createDecorator(eq("workshop"), anyString())).thenReturn(3);

        ToolResponse response = decoratorTools.createDecorator("workshop", json);

        assertThat(response.isError(), is(false));
        assertThat(text(response), containsString("ID: 3"));
    }

    @Test
    void return_error_when_the_namespace_is_full_on_create() throws Exception {
        when(decoratorStore.createDecorator(eq("workshop"), anyString()))
                .thenThrow(StorageWriteException.capacityExceeded(new RuntimeException("too big")));

        ToolResponse response = decoratorTools.createDecorator("workshop", "{\"type\":\"test\"}");

        assertThat(response.isError(), is(true));
        assertThat(text(response), is("Error: The namespace has reached the maximum storage size and cannot accept the decorator."));
    }

    @Test
    void return_error_when_the_namespace_is_full_on_update() throws Exception {
        org.mockito.Mockito.doThrow(StorageWriteException.capacityExceeded(new RuntimeException("too big")))
                .when(decoratorStore).updateDecorator(eq("workshop"), eq(1), anyString());

        ToolResponse response = decoratorTools.updateDecorator("workshop", 1, "{\"type\":\"test\"}");

        assertThat(response.isError(), is(true));
        assertThat(text(response), is("Error: The namespace has reached the maximum storage size and cannot accept the decorator."));
    }

    @Test
    void return_error_when_a_decorator_write_fails_in_the_store() throws Exception {
        when(decoratorStore.createDecorator(eq("workshop"), anyString()))
                .thenThrow(StorageWriteException.writeFailed(new RuntimeException("disk")));
        org.mockito.Mockito.doThrow(StorageWriteException.writeFailed(new RuntimeException("disk")))
                .when(decoratorStore).updateDecorator(eq("workshop"), eq(1), anyString());

        ToolResponse create = decoratorTools.createDecorator("workshop", "{\"type\":\"test\"}");
        ToolResponse update = decoratorTools.updateDecorator("workshop", 1, "{\"type\":\"test\"}");

        assertThat(create.isError(), is(true));
        assertThat(text(create), is("Error: The decorator write could not be completed due to a storage error."));
        assertThat(text(update), is(text(create)));
    }

    // --- write rules ---

    @Test
    void return_error_when_creating_a_decorator_with_a_type_that_is_not_a_string() {
        ToolResponse response = decoratorTools.createDecorator("workshop", "{\"type\":5}");

        assertThat(response.isError(), is(true));
        assertThat(text(response), containsString("'type' must be a string"));
        verifyNothingStored();
    }

    @Test
    void return_error_when_updating_a_decorator_with_a_target_that_is_not_an_array_of_strings() {
        ToolResponse response = decoratorTools.updateDecorator("workshop", 1, "{\"type\":\"threat-model\",\"target\":\"t\"}");

        assertThat(response.isError(), is(true));
        assertThat(text(response), containsString("'target' must be an array of strings"));
        verifyNothingStored();
    }

    @Test
    void return_error_when_creating_a_reserved_type_as_another_principal() {
        ToolResponse[] response = new ToolResponse[1];
        List<String> warnings = LogCapture.messages(DecoratorTools.class, Level.WARNING,
                () -> response[0] = decoratorTools.createDecorator("workshop", "{\"type\":\"control-evaluation\"}"));

        assertThat(warnings, contains(allOf(containsString("control-evaluation"), containsString("null"), containsString("workshop"))));
        assertThat(response[0].isError(), is(true));
        assertThat(text(response[0]), containsString("'control-evaluation' is reserved"));
        verifyNothingStored();
    }

    @Test
    void create_a_reserved_type_as_a_configured_writer() throws NamespaceNotFoundException {
        SecurityIdentity identity = mock(SecurityIdentity.class);
        Principal principal = () -> "policy-engine";
        when(identity.getPrincipal()).thenReturn(principal);
        decoratorTools.identity = identity;
        when(decoratorStore.createDecorator(eq("workshop"), anyString())).thenReturn(3);

        String result = text(decoratorTools.createDecorator("workshop", "{\"type\":\"control-evaluation\"}"));

        assertThat(result, containsString("ID: 3"));
    }

    @Test
    void return_error_when_updating_a_reserved_decorator_as_another_principal() throws Exception {
        when(decoratorStore.getDecoratorById("workshop", 1))
                .thenReturn(Optional.of(new Decorator.DecoratorBuilder().setType("control-evaluation").build()));

        ToolResponse[] response = new ToolResponse[1];
        List<String> warnings = LogCapture.messages(DecoratorTools.class, Level.WARNING,
                () -> response[0] = decoratorTools.updateDecorator("workshop", 1, "{\"type\":\"threat-model\"}"));

        assertThat(warnings, contains(allOf(containsString("control-evaluation"), containsString("1"), containsString("workshop"))));
        assertThat(response[0].isError(), is(true));
        assertThat(text(response[0]), containsString("is reserved"));
        verify(decoratorStore, never()).updateDecorator(anyString(), anyInt(), anyString());
    }

    @Test
    void return_the_schema_errors_when_creating_a_decorator_that_does_not_match_its_schema() {
        when(mockSchemaValidator.validate(any())).thenReturn(List.of(
                new DecoratorSchemaError("/data/status", "bad status"),
                new DecoratorSchemaError("", "missing property")));

        ToolResponse response = decoratorTools.createDecorator("workshop", "{\"type\":\"deployment\"}");

        assertThat(response.isError(), is(true));
        assertThat(text(response), containsString("- /data/status: bad status"));
        assertThat(text(response), containsString("- (root): missing property"));
        assertThat(text(response), not(containsString("more")));
        verifyNothingStored();
    }

    @Test
    void return_the_first_20_schema_errors_and_the_count_of_the_rest() {
        when(mockSchemaValidator.validate(any())).thenReturn(IntStream.range(0, 22)
                .mapToObj(i -> new DecoratorSchemaError("/target-type/" + i, "bad value")).toList());

        ToolResponse response = decoratorTools.createDecorator("workshop", "{\"type\":\"deployment\"}");

        assertThat(response.isError(), is(true));
        assertThat(text(response), containsString("- /target-type/19: bad value"));
        assertThat(text(response), not(containsString("/target-type/20")));
        assertThat(text(response), containsString("- and 2 more"));
    }

    @Test
    void return_the_schema_errors_when_updating_a_decorator_that_does_not_match_its_schema() throws Exception {
        when(mockSchemaValidator.validate(any())).thenReturn(List.of(new DecoratorSchemaError("/data", "bad")));

        ToolResponse response = decoratorTools.updateDecorator("workshop", 1, "{\"type\":\"deployment\"}");

        assertThat(response.isError(), is(true));
        assertThat(text(response), containsString("does not match its $schema"));
        verify(decoratorStore, never()).updateDecorator(anyString(), anyInt(), anyString());
    }

    @Test
    void report_the_new_id_when_an_update_supersedes_a_reserved_decorator() throws Exception {
        SecurityIdentity identity = mock(SecurityIdentity.class);
        Principal principal = () -> "policy-engine";
        when(identity.getPrincipal()).thenReturn(principal);
        decoratorTools.identity = identity;
        when(decoratorStore.getDecoratorById("workshop", 1))
                .thenReturn(Optional.of(new Decorator.DecoratorBuilder().setType("control-evaluation").build()));
        when(decoratorStore.supersedeDecorator(eq("workshop"), eq(1), anyString())).thenReturn(4);
        when(decoratorStore.getDecoratorById("workshop", 4))
                .thenReturn(Optional.of(new Decorator.DecoratorBuilder().setUniqueId("eval-4").setType("control-evaluation").build()));

        String[] output = new String[1];
        List<String> logs = LogCapture.messages(DecoratorTools.class, Level.INFO,
                () -> output[0] = text(decoratorTools.updateDecorator("workshop", 1, "{\"type\":\"control-evaluation\"}")));
        String result = output[0];

        assertThat(logs, hasItem(allOf(containsString("updated"), containsString("current decorator"), containsString("4"))));
        assertThat(result, containsString("superseded by new decorator 4"));
        assertThat(result, containsString("eval-4"));
    }

    @Test
    void return_error_when_updating_a_superseded_decorator() throws Exception {
        SecurityIdentity identity = mock(SecurityIdentity.class);
        Principal principal = () -> "policy-engine";
        when(identity.getPrincipal()).thenReturn(principal);
        decoratorTools.identity = identity;
        when(decoratorStore.getDecoratorById("workshop", 1))
                .thenReturn(Optional.of(new Decorator.DecoratorBuilder().setType("control-evaluation").build()));
        when(decoratorStore.supersedeDecorator(eq("workshop"), eq(1), anyString())).thenThrow(new DecoratorSupersededException());

        ToolResponse response = decoratorTools.updateDecorator("workshop", 1, "{\"type\":\"control-evaluation\"}");

        assertThat(response.isError(), is(true));
        assertThat(text(response), containsString("has been superseded"));
    }

    // --- getDecoratorHistory ---

    @Test
    void return_the_history_of_a_decorator() throws Exception {
        when(decoratorStore.getDecoratorHistory("workshop", 1)).thenReturn(List.of(
                new DecoratorHistoryEntry(2, 1, null, new Decorator.DecoratorBuilder().setUniqueId("eval-2").build()),
                new DecoratorHistoryEntry(1, null, 2, null)));

        String result = text(decoratorTools.getDecoratorHistory("workshop", 1));

        assertThat(result, containsString("- id: 2 (current), unique-id: eval-2"));
        assertThat(result, containsString("- id: 1, superseded by: 2"));
    }

    @Test
    void return_error_for_the_history_of_a_missing_decorator() throws Exception {
        when(decoratorStore.getDecoratorHistory("workshop", 9)).thenThrow(new DecoratorNotFoundException());

        ToolResponse response = decoratorTools.getDecoratorHistory("workshop", 9);

        assertThat(response.isError(), is(true));
        assertThat(text(response), containsString("not found"));
    }

    @Test
    void return_error_for_the_history_in_a_missing_namespace() throws Exception {
        when(decoratorStore.getDecoratorHistory("missing", 1)).thenThrow(new NamespaceNotFoundException());

        ToolResponse response = decoratorTools.getDecoratorHistory("missing", 1);

        assertThat(response.isError(), is(true));
        assertThat(text(response), containsString("Namespace 'missing' not found"));
    }

    @Test
    void reject_invalid_arguments_for_the_history() {
        assertThat(decoratorTools.getDecoratorHistory("bad ns", 1).isError(), is(true));
        assertThat(decoratorTools.getDecoratorHistory("workshop", 0).isError(), is(true));
        verifyNoInteractions(decoratorStore);
    }

    // --- MCP disabled ---

    @Test
    void return_disabled_message_when_mcp_is_disabled() {
        decoratorTools.mcpEnabled = false;

        ToolResponse listDec = decoratorTools.listDecorators("workshop", null, null);
        ToolResponse getDec = decoratorTools.getDecorator("workshop", 1);
        ToolResponse createDec = decoratorTools.createDecorator("workshop", "{\"type\":\"test\"}");
        ToolResponse updateDec = decoratorTools.updateDecorator("workshop", 1, "{\"type\":\"test\"}");

        assertThat(listDec.isError(), is(true));
        assertThat(text(listDec), containsString("disabled"));
        assertThat(getDec.isError(), is(true));
        assertThat(text(getDec), containsString("disabled"));
        assertThat(createDec.isError(), is(true));
        assertThat(text(createDec), containsString("disabled"));
        assertThat(updateDec.isError(), is(true));
        assertThat(text(updateDec), containsString("disabled"));
        verifyNoInteractions(decoratorStore);
    }

    @Test
    void return_error_when_put_operations_disabled_for_update_decorator() {
        decoratorTools.allowPutOperations = false;

        ToolResponse response = decoratorTools.updateDecorator("workshop", 1, "{\"type\":\"test\"}");

        assertThat(response.isError(), is(true));
        assertThat(text(response), containsString("allow.put.operations"));
        verifyNoInteractions(decoratorStore);
    }

    @Test
    void reject_oversized_json_for_create_decorator() {
        String hugeJson = "{\"x\":\"" + "a".repeat(SchemaValidationLimits.MAX_DECORATOR_JSON_BYTES + 1) + "\"}";

        ToolResponse response = decoratorTools.createDecorator("workshop", hugeJson);

        assertThat(response.isError(), is(true));
        assertThat(text(response), containsString("Decorator JSON"));
        verifyNoInteractions(decoratorStore);
    }

    @Test
    void reject_oversized_json_for_update_decorator() {
        String hugeJson = "{\"x\":\"" + "a".repeat(SchemaValidationLimits.MAX_DECORATOR_JSON_BYTES + 1) + "\"}";

        ToolResponse response = decoratorTools.updateDecorator("workshop", 1, hugeJson);

        assertThat(response.isError(), is(true));
        assertThat(text(response), containsString("Decorator JSON"));
        verifyNoInteractions(decoratorStore);
    }

    // A write the service refuses may ask whether the store is writable, and nothing else.
    private void verifyNothingStored() {
        verify(decoratorStore, atLeastOnce()).requireWritable();
        verifyNoMoreInteractions(decoratorStore);
    }
}
