package org.finos.calm.mcp.tools;

import org.finos.calm.domain.Decorator;
import org.finos.calm.domain.exception.DecoratorNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.DecoratorStore;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.startsWith;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestDecoratorToolsShould {

    @Mock
    DecoratorStore decoratorStore;

    @InjectMocks
    DecoratorTools decoratorTools;

    @BeforeEach
    void setup() {
        decoratorTools.mcpEnabled = true;
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

        String result = decoratorTools.listDecorators("workshop", "", "threat-model");

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

        String result = decoratorTools.listDecorators("workshop", "/calm/ns/1", "deployment");

        assertThat(result, containsString("filtered-dec"));
    }

    @Test
    void return_no_decorators_message_when_empty() throws NamespaceNotFoundException {
        when(decoratorStore.getDecoratorValuesForNamespace("workshop", null, null))
                .thenReturn(List.of());

        String result = decoratorTools.listDecorators("workshop", "", "");

        assertThat(result, containsString("No decorators found"));
    }

    @Test
    void return_no_decorators_message_with_type_filter() throws NamespaceNotFoundException {
        when(decoratorStore.getDecoratorValuesForNamespace("workshop", null, "deployment"))
                .thenReturn(List.of());

        String result = decoratorTools.listDecorators("workshop", null, "deployment");

        assertThat(result, containsString("No decorators found"));
        assertThat(result, containsString("deployment"));
    }

    @Test
    void return_error_for_missing_namespace() throws NamespaceNotFoundException {
        when(decoratorStore.getDecoratorValuesForNamespace("missing", null, null))
                .thenThrow(new NamespaceNotFoundException());

        String result = decoratorTools.listDecorators("missing", "", "");

        assertThat(result, startsWith("Error:"));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   ", "bad namespace"})
    void reject_invalid_namespace_for_list_decorators(String namespace) {
        String result = decoratorTools.listDecorators(namespace, null, null);

        assertThat(result, startsWith("Error:"));
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

        String result = decoratorTools.getDecorator("workshop", 1);

        assertThat(result, containsString("threat-model-1"));
        assertThat(result, containsString("threat-model"));
    }

    @Test
    void return_not_found_when_decorator_optional_empty() throws Exception {
        when(decoratorStore.getDecoratorById("workshop", 99))
                .thenReturn(Optional.empty());

        String result = decoratorTools.getDecorator("workshop", 99);

        assertThat(result, containsString("not found"));
    }

    @Test
    void return_error_when_decorator_not_found_exception() throws Exception {
        when(decoratorStore.getDecoratorById("workshop", 99))
                .thenThrow(new DecoratorNotFoundException());

        String result = decoratorTools.getDecorator("workshop", 99);

        assertThat(result, startsWith("Error:"));
    }

    @Test
    void return_error_when_namespace_not_found_for_get_decorator() throws Exception {
        when(decoratorStore.getDecoratorById("missing", 1))
                .thenThrow(new NamespaceNotFoundException());

        String result = decoratorTools.getDecorator("missing", 1);

        assertThat(result, startsWith("Error:"));
        assertThat(result, containsString("Namespace"));
    }

    @Test
    void reject_invalid_namespace_for_get_decorator() {
        String result = decoratorTools.getDecorator("bad ns", 1);

        assertThat(result, startsWith("Error:"));
        verifyNoInteractions(decoratorStore);
    }

    // --- createDecorator ---

    @Test
    void create_decorator_successfully() throws NamespaceNotFoundException {
        when(decoratorStore.createDecorator(eq("workshop"), anyString()))
                .thenReturn(5);

        String result = decoratorTools.createDecorator("workshop", "{\"type\":\"threat-model\"}");

        assertThat(result, containsString("created successfully"));
        assertThat(result, containsString("5"));
    }

    @Test
    void return_error_when_creating_in_missing_namespace() throws NamespaceNotFoundException {
        when(decoratorStore.createDecorator(eq("missing"), anyString()))
                .thenThrow(new NamespaceNotFoundException());

        String result = decoratorTools.createDecorator("missing", "{}");

        assertThat(result, startsWith("Error:"));
    }

    @Test
    void reject_invalid_namespace_for_create_decorator() {
        String result = decoratorTools.createDecorator("bad ns", "{}");

        assertThat(result, startsWith("Error:"));
        verifyNoInteractions(decoratorStore);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   "})
    void reject_blank_json_for_create_decorator(String json) {
        String result = decoratorTools.createDecorator("workshop", json);

        assertThat(result, startsWith("Error:"));
        assertThat(result, containsString("Decorator JSON"));
        verifyNoInteractions(decoratorStore);
    }

    // --- updateDecorator ---

    @Test
    void update_decorator_successfully() throws Exception {
        String result = decoratorTools.updateDecorator("workshop", 1, "{\"updated\":true}");

        assertThat(result, containsString("updated successfully"));
    }

    @Test
    void return_error_when_updating_nonexistent_decorator() throws Exception {
        org.mockito.Mockito.doThrow(new DecoratorNotFoundException())
                .when(decoratorStore).updateDecorator(eq("workshop"), eq(99), anyString());

        String result = decoratorTools.updateDecorator("workshop", 99, "{}");

        assertThat(result, startsWith("Error:"));
    }

    @Test
    void return_error_when_updating_in_missing_namespace() throws Exception {
        org.mockito.Mockito.doThrow(new NamespaceNotFoundException())
                .when(decoratorStore).updateDecorator(eq("missing"), eq(1), anyString());

        String result = decoratorTools.updateDecorator("missing", 1, "{}");

        assertThat(result, startsWith("Error:"));
        assertThat(result, containsString("Namespace"));
    }

    @Test
    void reject_invalid_namespace_for_update_decorator() {
        String result = decoratorTools.updateDecorator("bad ns", 1, "{}");

        assertThat(result, startsWith("Error:"));
        verifyNoInteractions(decoratorStore);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   "})
    void reject_blank_json_for_update_decorator(String json) {
        String result = decoratorTools.updateDecorator("workshop", 1, json);

        assertThat(result, startsWith("Error:"));
        assertThat(result, containsString("Decorator JSON"));
        verifyNoInteractions(decoratorStore);
    }

    // --- MCP disabled ---

    @Test
    void return_disabled_message_when_mcp_is_disabled() {
        decoratorTools.mcpEnabled = false;

        assertThat(decoratorTools.listDecorators("workshop", null, null), containsString("disabled"));
        assertThat(decoratorTools.getDecorator("workshop", 1), containsString("disabled"));
        assertThat(decoratorTools.createDecorator("workshop", "{}"), containsString("disabled"));
        assertThat(decoratorTools.updateDecorator("workshop", 1, "{}"), containsString("disabled"));
        verifyNoInteractions(decoratorStore);
    }
}
