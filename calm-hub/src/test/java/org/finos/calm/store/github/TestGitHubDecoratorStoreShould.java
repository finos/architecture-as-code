package org.finos.calm.store.github;

import org.finos.calm.domain.Decorator;
import org.finos.calm.domain.exception.DecoratorNotFoundException;
import org.finos.calm.domain.exception.GitHubWriteNotSupportedException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.github.access.NamespaceFileReader;
import org.finos.calm.store.github.registry.RegistryEntry;
import org.finos.calm.store.github.registry.RegistryResourceType;
import org.finos.calm.store.github.registry.ResourceRegistry;
import org.finos.calm.store.github.registry.RegistrySnapshot;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.IOException;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestGitHubDecoratorStoreShould {

    @Mock
    private ResourceRegistry registryService;

    @Mock
    private NamespaceFileReader fileReader;

    private GitHubDecoratorStore store;

    @BeforeEach
    void setup() {
        store = new GitHubDecoratorStore(registryService, fileReader);
    }

    @Test
    void return_empty_decorators_for_namespace() throws NamespaceNotFoundException {
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of()),
                Map.of());
        when(registryService.getSnapshot()).thenReturn(snapshot);

        List<Integer> result = store.getDecoratorsForNamespace("finos", "target", "type");

        assertThat(result, is(empty()));
    }

    @Test
    void return_empty_decorator_values_for_namespace() throws NamespaceNotFoundException {
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of()),
                Map.of());
        when(registryService.getSnapshot()).thenReturn(snapshot);

        List<Decorator> result = store.getDecoratorValuesForNamespace("finos", "target", "type");

        assertThat(result, is(empty()));
    }

    @Test
    void return_empty_optional_for_decorator_by_id() throws NamespaceNotFoundException {
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of()),
                Map.of());
        when(registryService.getSnapshot()).thenReturn(snapshot);

        Optional<Decorator> result = store.getDecoratorById("finos", 1);

        assertThat(result, equalTo(Optional.empty()));
    }

    @Test
    void throw_namespace_not_found_on_get_decorators() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.getDecoratorsForNamespace("nonexistent", "target", "type"));
    }

    @Test
    void throw_namespace_not_found_on_get_decorator_values() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.getDecoratorValuesForNamespace("nonexistent", "target", "type"));
    }

    @Test
    void throw_namespace_not_found_on_get_decorator_by_id() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.getDecoratorById("nonexistent", 1));
    }

    @Test
    void refuse_writes_before_any_lookup() {
        assertThrows(GitHubWriteNotSupportedException.class, () -> store.requireWritable());
    }

    @Test
    void throw_unsupported_on_create_decorator() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.createDecorator("finos", "{}"));
    }

    @Test
    void throw_unsupported_on_update_decorator() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.updateDecorator("finos", 1, "{}"));
    }

    @Test
    void throw_unsupported_on_delete_current_decorator_history() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.deleteCurrentDecoratorHistory("finos", 1));
    }

    @Test
    void throw_unsupported_on_supersede_decorator() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.supersedeDecorator("finos", 1, "{}"));
    }

    @Test
    void throw_decorator_not_found_on_get_decorator_history() {
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of()),
                Map.of());
        when(registryService.getSnapshot()).thenReturn(snapshot);

        assertThrows(DecoratorNotFoundException.class, () -> store.getDecoratorHistory("finos", 1));
    }

    @Test
    void throw_namespace_not_found_on_get_decorator_history() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);

        assertThrows(NamespaceNotFoundException.class, () -> store.getDecoratorHistory("nonexistent", 1));
    }

    private static final String OWNER_JSON = """
            {"unique-id":"owner-cproc","type":"business",
             "target":["/calm/namespaces/gtc/architectures/voice/versions/1.0.0"],
             "applies-to":["dockerpbx"],"data":{"owner-team":"CPROC"}}""";

    private static final String DEPLOY_JSON = """
            {"unique-id":"deploy-1","type":"deployment","target":["architectures/other.architecture.json"],
             "applies-to":["x"],"data":{"status":"ok"}}""";

    private static RegistryEntry decoratorEntry(String id, String file) {
        return new RegistryEntry(id, Path.of(file), RegistryResourceType.DECORATOR, id, Instant.EPOCH);
    }

    private void givenDecorators(String ownerJson, String deployJson) throws IOException {
        RegistryEntry owner = decoratorEntry("owner-cproc", "decorators/owner-cproc.decorator.json");
        RegistryEntry deploy = decoratorEntry("deploy-1", "decorators/deploy-1.decorator.json");
        lenient().when(registryService.getSnapshot()).thenReturn(new RegistrySnapshot(Map.of("gtc", List.of(owner, deploy)), Map.of()));
        lenient().when(registryService.listByType("gtc", RegistryResourceType.DECORATOR)).thenReturn(List.of(owner, deploy));
        lenient().when(fileReader.readContained("gtc", owner.filePath())).thenReturn(ownerJson);
        lenient().when(fileReader.readContained("gtc", deploy.filePath())).thenReturn(deployJson);
    }

    private static int id(String uniqueId) {
        return uniqueId.hashCode() & 0x7FFFFFFF;
    }

    @Test
    void list_the_decorators_found_in_the_clone() throws Exception {
        givenDecorators(OWNER_JSON, DEPLOY_JSON);

        assertThat(store.getDecoratorsForNamespace("gtc", null, null),
                contains(id("owner-cproc"), id("deploy-1")));
        assertThat(store.getDecoratorValuesForNamespace("gtc", null, null).size(), is(2));
    }

    @Test
    void filter_decorators_by_type() throws Exception {
        givenDecorators(OWNER_JSON, DEPLOY_JSON);

        assertThat(store.getDecoratorsForNamespace("gtc", null, "deployment"), contains(id("deploy-1")));
    }

    private void givenArchitecture(String uniqueId, String file) {
        lenient().when(registryService.listByType("gtc", RegistryResourceType.ARCHITECTURE))
                .thenReturn(List.of(new RegistryEntry(uniqueId, Path.of(file), RegistryResourceType.ARCHITECTURE, uniqueId, Instant.EPOCH)));
    }

    @Test
    void match_a_target_that_names_the_same_architecture_with_any_version() throws Exception {
        givenDecorators(OWNER_JSON, DEPLOY_JSON);

        assertThat(store.getDecoratorsForNamespace("gtc", "/calm/namespaces/gtc/architectures/voice/versions/abc1234", null),
                contains(id("owner-cproc")));
        assertThat(store.getDecoratorsForNamespace("gtc", "/calm/namespaces/gtc/architectures/voice", null),
                contains(id("owner-cproc")));
    }

    @Test
    void match_the_numeric_architecture_id_the_ui_sends_to_the_architecture_a_decorator_names_by_slug() throws Exception {
        givenDecorators(OWNER_JSON, DEPLOY_JSON);
        givenArchitecture("voice", "architectures/voice.architecture.json");

        String uiTarget = "/api/calm/namespaces/gtc/architectures/" + id("voice") + "/versions/1-0-0";

        assertThat(store.getDecoratorsForNamespace("gtc", uiTarget, null), contains(id("owner-cproc")));
    }

    @Test
    void match_a_decorator_that_targets_the_architecture_file_path() throws Exception {
        givenDecorators(OWNER_JSON, DEPLOY_JSON);
        givenArchitecture("other", "architectures/other.architecture.json");

        String uiTarget = "/api/calm/namespaces/gtc/architectures/" + id("other") + "/versions/1-0-0";

        assertThat(store.getDecoratorsForNamespace("gtc", uiTarget, null), contains(id("deploy-1")));
    }

    @Test
    void not_match_a_numeric_id_that_belongs_to_no_architecture() throws Exception {
        givenDecorators(OWNER_JSON, DEPLOY_JSON);

        assertThat(store.getDecoratorsForNamespace("gtc", "/api/calm/namespaces/gtc/architectures/123/versions/1-0-0", null),
                is(empty()));
    }

    @Test
    void filter_decorators_by_an_exact_non_architecture_target() throws Exception {
        givenDecorators(OWNER_JSON, DEPLOY_JSON);

        assertThat(store.getDecoratorsForNamespace("gtc", "architectures/other.architecture.json", null),
                contains(id("deploy-1")));
        assertThat(store.getDecoratorsForNamespace("gtc", "architectures/unknown.architecture.json", null), is(empty()));
    }

    @Test
    void skip_a_decorator_without_a_target_when_filtering_by_target() throws Exception {
        givenDecorators("{\"unique-id\":\"owner-cproc\",\"type\":\"business\"}", DEPLOY_JSON);

        assertThat(store.getDecoratorsForNamespace("gtc", "architectures/other.architecture.json", null),
                contains(id("deploy-1")));
    }

    @Test
    void skip_a_file_that_is_not_a_decorator() throws Exception {
        givenDecorators("not json", DEPLOY_JSON);

        assertThat(store.getDecoratorsForNamespace("gtc", null, null), contains(id("deploy-1")));
    }

    @Test
    void skip_a_file_that_cannot_be_read() throws Exception {
        RegistryEntry owner = decoratorEntry("owner-cproc", "decorators/owner-cproc.decorator.json");
        when(registryService.getSnapshot()).thenReturn(new RegistrySnapshot(Map.of("gtc", List.of(owner)), Map.of()));
        lenient().when(registryService.listByType("gtc", RegistryResourceType.DECORATOR)).thenReturn(List.of(owner));
        when(fileReader.readContained(any(), any())).thenThrow(new IOException("gone"));

        assertThat(store.getDecoratorsForNamespace("gtc", null, null), is(empty()));
    }

    @Test
    void return_a_decorator_by_id() throws Exception {
        givenDecorators(OWNER_JSON, DEPLOY_JSON);

        Optional<Decorator> found = store.getDecoratorById("gtc", id("owner-cproc"));

        assertThat(found.isPresent(), is(true));
        assertThat(found.get().getUniqueId(), equalTo("owner-cproc"));
        assertThat(found.get().getType(), equalTo("business"));
    }

    @Test
    void return_empty_for_an_unknown_decorator_id() throws Exception {
        givenDecorators(OWNER_JSON, DEPLOY_JSON);

        assertThat(store.getDecoratorById("gtc", 42), equalTo(Optional.empty()));
    }

    @Test
    void return_the_current_decorator_as_its_only_history_entry() throws Exception {
        givenDecorators(OWNER_JSON, DEPLOY_JSON);

        var history = store.getDecoratorHistory("gtc", id("owner-cproc"));

        assertThat(history.size(), is(1));
        assertThat(history.get(0).getId(), is(id("owner-cproc")));
        assertThat(history.get(0).getSupersedes(), equalTo(null));
        assertThat(history.get(0).getSupersededBy(), equalTo(null));
    }
}
