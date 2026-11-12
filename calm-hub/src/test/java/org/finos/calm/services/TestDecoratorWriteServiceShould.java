package org.finos.calm.services;

import io.quarkus.security.identity.SecurityIdentity;
import org.bson.json.JsonParseException;
import org.finos.calm.config.DecoratorConfig;
import org.finos.calm.domain.Decorator;
import org.finos.calm.domain.DecoratorHistoryEntry;
import org.finos.calm.domain.DecoratorSchemaError;
import org.finos.calm.domain.SchemaValidationLimits;
import org.finos.calm.domain.exception.DecoratorNotFoundException;
import org.finos.calm.domain.exception.DecoratorSchemaValidationException;
import org.finos.calm.domain.exception.DecoratorSupersededException;
import org.finos.calm.domain.exception.DecoratorTooLargeException;
import org.finos.calm.domain.exception.GitHubWriteNotSupportedException;
import org.finos.calm.domain.exception.ReservedDecoratorTypeException;
import org.finos.calm.store.DecoratorStore;
import org.finos.calm.store.github.GitHubDecoratorStore;
import org.finos.calm.store.github.registry.RegistrySnapshot;
import org.finos.calm.store.github.registry.ResourceRegistry;
import org.finos.calm.testutil.LogCapture;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.security.Principal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.logging.Level;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.allOf;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestDecoratorWriteServiceShould {

    private static final String NAMESPACE = "finos";
    private static final String WRITER = "policy-engine";
    private static final String RESERVED_JSON = "{\"type\": \"control-evaluation\", \"data\": {}}";
    private static final String UNRESERVED_JSON = "{\"type\": \"threat-model\", \"data\": {}}";

    @Mock
    DecoratorStore mockDecoratorStore;

    @Mock
    DecoratorConfig mockConfig;

    @Mock
    DecoratorSchemaValidator mockSchemaValidator;

    DecoratorWriteService service;

    @BeforeEach
    void setup() {
        DecoratorConfig.ReservedType reserved = () -> List.of(WRITER);
        lenient().when(mockConfig.reserved()).thenReturn(Map.of("control-evaluation", reserved));
        lenient().when(mockSchemaValidator.validate(any())).thenReturn(List.of());
        service = new DecoratorWriteService(mockDecoratorStore, mockConfig, mockSchemaValidator);
    }

    @Test
    void log_each_reserved_type_with_its_writer_count_at_startup() {
        DecoratorConfig.ReservedType twoWriters = () -> List.of("system", "auditor");
        DecoratorConfig.ReservedType oneWriter = () -> List.of(WRITER);
        when(mockConfig.reserved()).thenReturn(Map.of("validation", twoWriters, "control-evaluation", oneWriter));

        assertThat(infoLogs(() -> service.logReservedTypes(null)),
                contains(allOf(containsString("Reserved decorator types"),
                        containsString("control-evaluation (1 writers), validation (2 writers)"))));
    }

    @Test
    void log_that_no_type_is_reserved_at_startup() {
        when(mockConfig.reserved()).thenReturn(Map.of());

        assertThat(infoLogs(() -> service.logReservedTypes(null)), contains("No decorator type is reserved"));
    }

    private static List<String> infoLogs(Runnable action) {
        return LogCapture.messages(DecoratorWriteService.class, Level.INFO, action);
    }

    @Test
    void create_a_reserved_decorator_for_a_configured_writer() throws Exception {
        when(mockDecoratorStore.createDecorator(NAMESPACE, RESERVED_JSON)).thenReturn(7);

        assertThat(service.createDecorator(WRITER, NAMESPACE, RESERVED_JSON), is(7));
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"alice"})
    void refuse_a_reserved_decorator_from_any_other_principal(String principal) {
        ReservedDecoratorTypeException e = assertThrows(ReservedDecoratorTypeException.class,
                () -> service.createDecorator(principal, NAMESPACE, RESERVED_JSON));

        assertThat(e.getType(), is("control-evaluation"));
        verifyNoInteractions(mockDecoratorStore);
    }

    @ParameterizedTest
    @ValueSource(strings = {UNRESERVED_JSON, "{}"})
    void create_an_unreserved_decorator_for_any_principal(String json) throws Exception {
        service.createDecorator("alice", NAMESPACE, json);

        verify(mockDecoratorStore).createDecorator(NAMESPACE, json);
    }

    @Test
    void refuse_a_decorator_that_does_not_match_its_schema() {
        List<DecoratorSchemaError> errors = List.of(new DecoratorSchemaError("/data", "bad"));
        when(mockSchemaValidator.validate(any())).thenReturn(errors);

        DecoratorSchemaValidationException e = assertThrows(DecoratorSchemaValidationException.class,
                () -> service.createDecorator("alice", NAMESPACE, UNRESERVED_JSON));

        assertThat(e.getErrors(), is(errors));
        verifyNoInteractions(mockDecoratorStore);
    }

    @Test
    void check_the_reserved_type_before_the_schema() {
        assertThrows(ReservedDecoratorTypeException.class,
                () -> service.createDecorator("alice", NAMESPACE, RESERVED_JSON));

        verifyNoInteractions(mockSchemaValidator);
    }

    @ParameterizedTest
    @ValueSource(strings = {"not json", "[1, 2]", "null"})
    void refuse_json_that_is_not_an_object(String json) {
        assertThrows(JsonParseException.class, () -> service.createDecorator("alice", NAMESPACE, json));
    }

    @Test
    void refuse_a_missing_body() {
        assertThrows(JsonParseException.class, () -> service.createDecorator("alice", NAMESPACE, null));
    }

    @Test
    void update_an_unreserved_decorator_for_any_principal() throws Exception {
        when(mockDecoratorStore.getDecoratorById(NAMESPACE, 1)).thenReturn(Optional.of(decorator("threat-model")));

        assertThat(service.updateDecorator("alice", NAMESPACE, 1, UNRESERVED_JSON), is(1));

        verify(mockDecoratorStore).updateDecorator(NAMESPACE, 1, UNRESERVED_JSON);
        verify(mockDecoratorStore, never()).supersedeDecorator(anyString(), anyInt(), anyString());
    }

    @Test
    void supersede_a_reserved_decorator_instead_of_updating_it() throws Exception {
        when(mockDecoratorStore.getDecoratorById(NAMESPACE, 1)).thenReturn(Optional.of(decorator("control-evaluation")));
        when(mockDecoratorStore.supersedeDecorator(NAMESPACE, 1, RESERVED_JSON)).thenReturn(8);

        assertThat(service.updateDecorator(WRITER, NAMESPACE, 1, RESERVED_JSON), is(8));

        verify(mockDecoratorStore, never()).updateDecorator(anyString(), anyInt(), anyString());
    }

    @Test
    void supersede_an_unreserved_decorator_that_changes_to_a_reserved_type() throws Exception {
        when(mockDecoratorStore.getDecoratorById(NAMESPACE, 1)).thenReturn(Optional.of(decorator("threat-model")));
        when(mockDecoratorStore.supersedeDecorator(NAMESPACE, 1, RESERVED_JSON)).thenReturn(8);

        assertThat(service.updateDecorator(WRITER, NAMESPACE, 1, RESERVED_JSON), is(8));
    }

    @Test
    void pass_on_that_a_decorator_has_already_been_superseded() throws Exception {
        when(mockDecoratorStore.getDecoratorById(NAMESPACE, 1)).thenReturn(Optional.of(decorator("control-evaluation")));
        when(mockDecoratorStore.supersedeDecorator(NAMESPACE, 1, RESERVED_JSON)).thenThrow(new DecoratorSupersededException());

        assertThrows(DecoratorSupersededException.class,
                () -> service.updateDecorator(WRITER, NAMESPACE, 1, RESERVED_JSON));
    }

    @Test
    void pass_on_that_an_unreserved_entry_has_been_superseded_without_reading_its_history() throws Exception {
        when(mockDecoratorStore.getDecoratorById(NAMESPACE, 1)).thenReturn(Optional.of(decorator("threat-model")));
        doThrow(new DecoratorSupersededException())
                .when(mockDecoratorStore).updateDecorator(NAMESPACE, 1, UNRESERVED_JSON);

        assertThrows(DecoratorSupersededException.class,
                () -> service.updateDecorator("alice", NAMESPACE, 1, UNRESERVED_JSON));

        verify(mockDecoratorStore, never()).getDecoratorHistory(anyString(), anyInt());
    }

    @Test
    void refuse_an_update_of_a_reserved_decorator_from_another_principal() throws Exception {
        when(mockDecoratorStore.getDecoratorById(NAMESPACE, 1)).thenReturn(Optional.of(decorator("control-evaluation")));

        assertThrows(ReservedDecoratorTypeException.class,
                () -> service.updateDecorator("alice", NAMESPACE, 1, UNRESERVED_JSON));
        verify(mockDecoratorStore, never()).updateDecorator(anyString(), anyInt(), anyString());
    }

    @Test
    void refuse_an_update_to_a_reserved_type_from_another_principal() throws Exception {
        when(mockDecoratorStore.getDecoratorById(NAMESPACE, 1)).thenReturn(Optional.of(decorator("threat-model")));

        assertThrows(ReservedDecoratorTypeException.class,
                () -> service.updateDecorator("alice", NAMESPACE, 1, RESERVED_JSON));
        verify(mockDecoratorStore, never()).updateDecorator(anyString(), anyInt(), anyString());
    }

    @Test
    void leave_a_missing_decorator_on_update_to_the_store() throws Exception {
        when(mockDecoratorStore.getDecoratorById(NAMESPACE, 1)).thenReturn(Optional.empty());
        doThrow(new DecoratorNotFoundException())
                .when(mockDecoratorStore).updateDecorator(NAMESPACE, 1, UNRESERVED_JSON);

        assertThrows(DecoratorNotFoundException.class,
                () -> service.updateDecorator("alice", NAMESPACE, 1, UNRESERVED_JSON));
    }

    @Test
    void delete_the_whole_history_through_its_current_decorator_without_a_writer_check() throws Exception {
        when(mockDecoratorStore.getDecoratorHistory(NAMESPACE, 1)).thenReturn(List.of(
                new DecoratorHistoryEntry(2, 1, null, decorator("control-evaluation")),
                new DecoratorHistoryEntry(1, null, 2, decorator("threat-model"))));

        service.deleteDecorator(NAMESPACE, 1);

        verify(mockDecoratorStore).deleteCurrentDecoratorHistory(NAMESPACE, 2);
        verify(mockDecoratorStore, never()).getDecoratorById(anyString(), anyInt());
    }

    @Test
    void require_a_current_head_also_for_an_entry_that_has_no_decorator() throws Exception {
        when(mockDecoratorStore.getDecoratorHistory(NAMESPACE, 1)).thenReturn(List.of(
                new DecoratorHistoryEntry(1, null, null, null)));

        service.deleteDecorator(NAMESPACE, 1);

        verify(mockDecoratorStore).deleteCurrentDecoratorHistory(NAMESPACE, 1);
    }

    @Test
    void pass_on_that_a_decorator_to_delete_does_not_exist() throws Exception {
        when(mockDecoratorStore.getDecoratorHistory(NAMESPACE, 1)).thenThrow(new DecoratorNotFoundException());

        assertThrows(DecoratorNotFoundException.class, () -> service.deleteDecorator(NAMESPACE, 1));

        verify(mockDecoratorStore, never()).deleteCurrentDecoratorHistory(anyString(), anyInt());
    }

    @Test
    void pass_on_a_delete_that_loses_to_a_supersede() throws Exception {
        when(mockDecoratorStore.getDecoratorHistory(NAMESPACE, 1)).thenReturn(List.of(
                new DecoratorHistoryEntry(1, null, null, decorator("threat-model"))));
        doThrow(new DecoratorSupersededException()).when(mockDecoratorStore).deleteCurrentDecoratorHistory(NAMESPACE, 1);

        assertThrows(DecoratorSupersededException.class, () -> service.deleteDecorator(NAMESPACE, 1));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{\"type\": 5, \"data\": {}}",
            "{\"type\": null, \"data\": {}}",
            "{\"unique-id\": 7, \"type\": \"threat-model\"}",
            "{\"$schema\": {}, \"type\": \"threat-model\"}",
            "{\"type\": \"threat-model\", \"target\": \"t\"}",
            "{\"type\": \"threat-model\", \"target\": [\"t\", 1]}",
            "{\"type\": \"threat-model\", \"applies-to\": {}}",
            "{\"type\": \"threat-model\", \"target-type\": [null]}"
    })
    void refuse_a_decorator_whose_hub_read_fields_have_the_wrong_type(String json) {
        assertThrows(JsonParseException.class, () -> service.createDecorator("alice", NAMESPACE, json));
        assertThrows(JsonParseException.class, () -> service.updateDecorator("alice", NAMESPACE, 1, json));
        verifyNoInteractions(mockDecoratorStore);
    }

    @Test
    void accept_hub_read_fields_of_the_right_type_or_left_out() throws Exception {
        String json = "{\"$schema\": \"s\", \"unique-id\": \"u\", \"type\": \"threat-model\", \"target\": [\"t\"], \"target-type\": [], \"applies-to\": [\"a\"]}";
        when(mockDecoratorStore.createDecorator(NAMESPACE, json)).thenReturn(1);
        when(mockDecoratorStore.createDecorator(NAMESPACE, "{\"data\": {}}")).thenReturn(2);

        assertThat(service.createDecorator("alice", NAMESPACE, json), is(1));
        assertThat(service.createDecorator("alice", NAMESPACE, "{\"data\": {}}"), is(2));
    }

    @Test
    void report_which_types_are_reserved() {
        assertThat(service.isReserved("control-evaluation"), is(true));
        assertThat(service.isReserved("threat-model"), is(false));
        assertThat(service.isReserved(null), is(false));
    }

    @Test
    void name_the_principal_of_an_identity() {
        SecurityIdentity identity = mock(SecurityIdentity.class);
        Principal principal = () -> "alice";
        when(identity.getPrincipal()).thenReturn(principal);

        assertThat(DecoratorWriteService.principalName(identity), is("alice"));
    }

    @Test
    void name_no_principal_for_an_anonymous_or_missing_identity() {
        SecurityIdentity identity = mock(SecurityIdentity.class);
        when(identity.isAnonymous()).thenReturn(true);

        assertThat(DecoratorWriteService.principalName(identity), is(nullValue()));
        assertThat(DecoratorWriteService.principalName(null), is(nullValue()));
    }

    private static Decorator decorator(String type) {
        return new Decorator.DecoratorBuilder().setType(type).build();
    }

    @Test
    void refuse_a_delete_in_github_mode_before_it_looks_up_the_history() {
        DecoratorWriteService gitHubService = new DecoratorWriteService(gitHubStore(), mockConfig, mockSchemaValidator);

        assertThrows(GitHubWriteNotSupportedException.class, () -> gitHubService.deleteDecorator(NAMESPACE, 1));
    }

    @Test
    void look_up_the_history_of_a_delete_only_after_the_store_accepts_writes() throws Exception {
        doThrow(new GitHubWriteNotSupportedException("no writes")).when(mockDecoratorStore).requireWritable();

        assertThrows(GitHubWriteNotSupportedException.class, () -> service.deleteDecorator(NAMESPACE, 1));

        verify(mockDecoratorStore, never()).getDecoratorHistory(anyString(), anyInt());
        verify(mockDecoratorStore, never()).deleteCurrentDecoratorHistory(anyString(), anyInt());
    }

    @Test
    void accept_a_decorator_of_exactly_the_size_limit() throws Exception {
        String json = decoratorOfBytes(SchemaValidationLimits.MAX_DECORATOR_JSON_BYTES);
        when(mockDecoratorStore.createDecorator(NAMESPACE, json)).thenReturn(1);

        assertThat(service.createDecorator("alice", NAMESPACE, json), is(1));
    }

    @Test
    void refuse_a_decorator_over_the_size_limit_before_any_other_check() {
        String json = decoratorOfBytes(SchemaValidationLimits.MAX_DECORATOR_JSON_BYTES + 1);

        assertThrows(DecoratorTooLargeException.class, () -> service.createDecorator("alice", NAMESPACE, json));
        assertThrows(DecoratorTooLargeException.class, () -> service.updateDecorator("alice", NAMESPACE, 1, json));
        verifyNoInteractions(mockDecoratorStore, mockSchemaValidator);
    }

    @Test
    void count_the_size_limit_in_utf8_bytes() {
        String json = "{\"data\": \"" + "\u00e9".repeat(SchemaValidationLimits.MAX_DECORATOR_JSON_BYTES / 2) + "\"}";

        assertThrows(DecoratorTooLargeException.class, () -> service.createDecorator("alice", NAMESPACE, json));
        verifyNoInteractions(mockDecoratorStore);
    }

    // A {"data": "..."} decorator of the given size in UTF-8 bytes.
    static String decoratorOfBytes(int bytes) {
        String prefix = "{\"data\": \"";
        String suffix = "\"}";
        return prefix + "x".repeat(bytes - prefix.length() - suffix.length()) + suffix;
    }

    private static GitHubDecoratorStore gitHubStore() {
        ResourceRegistry registry = mock(ResourceRegistry.class);
        lenient().when(registry.getSnapshot()).thenReturn(new RegistrySnapshot(Map.of(NAMESPACE, List.of()), Map.of()));
        return new GitHubDecoratorStore(registry);
    }
}
