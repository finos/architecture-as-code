package org.finos.calm.store.github;

import org.finos.calm.domain.controls.ControlDetail;
import org.finos.calm.domain.controls.CreateControlConfiguration;
import org.finos.calm.domain.controls.CreateControlRequirement;
import org.finos.calm.domain.exception.ControlConfigurationNotFoundException;
import org.finos.calm.domain.exception.ControlNotFoundException;
import org.finos.calm.domain.exception.ControlRequirementVersionNotFoundException;
import org.finos.calm.domain.exception.DomainNotFoundException;
import org.finos.calm.store.github.access.NamespaceAccessFilter;
import org.finos.calm.store.github.access.NamespaceFileReader;
import org.finos.calm.store.github.api.GitHubFileHistoryClient;
import org.finos.calm.store.github.config.GitHubStoreConfig;
import org.finos.calm.store.github.registry.RegistryEntry;
import org.finos.calm.store.github.registry.RegistryResourceType;
import org.finos.calm.store.github.registry.RegistrySnapshot;
import org.finos.calm.store.github.registry.ResourceRegistry;
import org.finos.calm.store.github.sync.GitHubCloneManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestGitHubControlStoreShould {

    private static final String DOMAIN = "security";
    private static final String UNIQUE_ID = "my-control";
    private static final int HASH_ID = UNIQUE_ID.hashCode() & 0x7FFFFFFF;

    @Mock
    private ResourceRegistry registryService;

    @Mock
    private GitHubCloneManager cloneManager;

    @Mock
    private GitHubFileHistoryClient versionService;

    @Mock
    private NamespaceFileReader fileReader;

    @Mock
    private NamespaceAccessFilter accessFilter;

    private GitHubControlStore store;

    @BeforeEach
    void setup() {
        store = new GitHubControlStore(registryService, cloneManager, versionService, fileReader, accessFilter);
    }

    @Test
    void return_controls_for_domain() throws Exception {
        // Registry namespace ("finos") deliberately differs from the control domain
        // ("security", derived from the controls/security/ path segment) - the two are
        // unrelated concepts, and a fixture where they happen to share a name would hide
        // a namespace/domain mix-up regression (see the cross-domain-match test below).
        RegistryEntry entry = new RegistryEntry(UNIQUE_ID, Path.of("controls/security/my-control.json"),
                RegistryResourceType.CONTROL, "My Control", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:" + UNIQUE_ID, entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.CONTROL)).thenReturn(List.of(entry));
        when(accessFilter.getAccessibleNamespaces()).thenReturn(Set.of("finos"));

        List<ControlDetail> result = store.getControlsForDomain(DOMAIN);

        assertThat(result, hasSize(1));
        assertThat(result.get(0).getName(), equalTo(UNIQUE_ID));
        assertThat(result.get(0).getTitle(), equalTo("My Control"));
        assertThat(result.get(0).getId(), equalTo(HASH_ID));
    }

    @Test
    void throw_domain_not_found_when_domain_missing_on_get_controls() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);
        when(accessFilter.getAccessibleNamespaces()).thenReturn(Set.of());

        assertThrows(DomainNotFoundException.class,
                () -> store.getControlsForDomain("nonexistent"));
    }

    @Test
    void hide_controls_from_inaccessible_namespaces() throws Exception {
        RegistryEntry accessibleEntry = new RegistryEntry("ctrl-a", Path.of("controls/security/ctrl-a.json"),
                RegistryResourceType.CONTROL, "Control A", Instant.now());
        RegistryEntry restrictedEntry = new RegistryEntry("ctrl-b", Path.of("controls/security/ctrl-b.json"),
                RegistryResourceType.CONTROL, "Control B", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(accessibleEntry), "private", List.of(restrictedEntry)),
                Map.of("finos:ctrl-a", accessibleEntry, "private:ctrl-b", restrictedEntry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.CONTROL)).thenReturn(List.of(accessibleEntry));
        when(accessFilter.getAccessibleNamespaces()).thenReturn(Set.of("finos"));

        List<ControlDetail> result = store.getControlsForDomain(DOMAIN);

        assertThat(result, hasSize(1));
        assertThat(result.get(0).getName(), equalTo("ctrl-a"));
    }

    @Test
    void deny_version_lookup_for_control_in_inaccessible_namespace() {
        RegistryEntry accessible = new RegistryEntry("ctrl-a", Path.of("controls/security/ctrl-a.json"),
                RegistryResourceType.CONTROL, "Control A", Instant.now());
        RegistryEntry restricted = new RegistryEntry(UNIQUE_ID, Path.of("controls/security/my-control.json"),
                RegistryResourceType.CONTROL, "My Control", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(accessible), "private", List.of(restricted)),
                Map.of("finos:ctrl-a", accessible, "private:" + UNIQUE_ID, restricted));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.CONTROL)).thenReturn(List.of(accessible));
        when(accessFilter.getAccessibleNamespaces()).thenReturn(Set.of("finos"));

        assertThrows(ControlNotFoundException.class,
                () -> store.getRequirementVersions(DOMAIN, HASH_ID));
    }

    @Test
    void return_versions_for_control_in_accessible_namespace_with_mixed_access() throws Exception {
        RegistryEntry accessible = new RegistryEntry(UNIQUE_ID, Path.of("controls/security/my-control.json"),
                RegistryResourceType.CONTROL, "My Control", Instant.now());
        RegistryEntry restricted = new RegistryEntry("other", Path.of("controls/security/other.json"),
                RegistryResourceType.CONTROL, "Other", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(accessible), "private", List.of(restricted)),
                Map.of("finos:" + UNIQUE_ID, accessible, "private:other", restricted));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.CONTROL)).thenReturn(List.of(accessible));
        when(accessFilter.getAccessibleNamespaces()).thenReturn(Set.of("finos"));
        when(cloneManager.headSha("finos")).thenReturn("1234567");

        List<String> versions = store.getRequirementVersions(DOMAIN, HASH_ID);

        assertThat(versions, hasSize(1));
        assertThat(versions.get(0), equalTo("1234567"));
    }

    @Test
    void return_empty_versions_when_neither_the_api_nor_the_local_clone_have_anything() throws Exception {
        RegistryEntry entry = new RegistryEntry(UNIQUE_ID, Path.of("controls/security/my-control.json"),
                RegistryResourceType.CONTROL, "My Control", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:" + UNIQUE_ID, entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.CONTROL)).thenReturn(List.of(entry));
        when(accessFilter.getAccessibleNamespaces()).thenReturn(Set.of("finos"));

        List<String> versions = store.getRequirementVersions(DOMAIN, HASH_ID);

        assertThat(versions, is(empty()));
    }

    @Test
    void fall_back_to_the_local_head_sha_when_the_api_returns_no_versions() throws Exception {
        RegistryEntry entry = new RegistryEntry(UNIQUE_ID, Path.of("controls/security/my-control.json"),
                RegistryResourceType.CONTROL, "My Control", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:" + UNIQUE_ID, entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.CONTROL)).thenReturn(List.of(entry));
        when(accessFilter.getAccessibleNamespaces()).thenReturn(Set.of("finos"));
        when(cloneManager.headSha("finos")).thenReturn("1234567");

        List<String> versions = store.getRequirementVersions(DOMAIN, HASH_ID);

        assertThat(versions, hasSize(1));
        assertThat(versions.get(0), equalTo("1234567"));
    }

    @Test
    void return_sha_versions_when_version_service_available() throws Exception {
        RegistryEntry entry = new RegistryEntry(UNIQUE_ID, Path.of("controls/security/my-control.json"),
                RegistryResourceType.CONTROL, "My Control", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:" + UNIQUE_ID, entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.CONTROL)).thenReturn(List.of(entry));
        when(accessFilter.getAccessibleNamespaces()).thenReturn(Set.of("finos"));

        when(cloneManager.getRepoForNamespace("finos")).thenReturn("org/repo");
        when(cloneManager.getBranchForNamespace("finos")).thenReturn("main");
        when(versionService.getFileVersions("org/repo", "main", "controls/security/my-control.json"))
                .thenReturn(List.of("abc1234", "def5678"));

        List<String> versions = store.getRequirementVersions(DOMAIN, HASH_ID);

        assertThat(versions, hasSize(2));
        assertThat(versions.get(0), equalTo("abc1234"));
    }

    @Test
    void return_control_content_for_the_current_head_version(@TempDir Path tempDir) throws Exception {
        Path controlDir = tempDir.resolve("finos/controls/security");
        Files.createDirectories(controlDir);
        Files.writeString(controlDir.resolve("my-control.json"), "{\"control\":\"data\"}");

        RegistryEntry entry = new RegistryEntry(UNIQUE_ID, Path.of("controls/security/my-control.json"),
                RegistryResourceType.CONTROL, "My Control", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:" + UNIQUE_ID, entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.CONTROL)).thenReturn(List.of(entry));
        when(accessFilter.getAccessibleNamespaces()).thenReturn(Set.of("finos"));
        when(cloneManager.headSha("finos")).thenReturn("abc1234");

        GitHubControlStore realFileReaderStore = new GitHubControlStore(registryService, cloneManager, versionService,
                new NamespaceFileReader(new GitHubStoreConfig("", tempDir.toString(), "https://api.github.com")),
                accessFilter);
        String content = realFileReaderStore.getRequirementForVersion(DOMAIN, HASH_ID, "abc1234");

        assertThat(content, equalTo("{\"control\":\"data\"}"));
    }

    @Test
    void return_content_from_github_api_for_sha_version() throws Exception {
        RegistryEntry entry = new RegistryEntry(UNIQUE_ID, Path.of("controls/security/my-control.json"),
                RegistryResourceType.CONTROL, "My Control", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:" + UNIQUE_ID, entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.CONTROL)).thenReturn(List.of(entry));
        when(accessFilter.getAccessibleNamespaces()).thenReturn(Set.of("finos"));

        when(cloneManager.getRepoForNamespace("finos")).thenReturn("org/repo");
        when(versionService.getFileAtVersion("org/repo", "controls/security/my-control.json", "abc1234"))
                .thenReturn("{\"control\":\"old-data\"}");

        String content = store.getRequirementForVersion(DOMAIN, HASH_ID, "abc1234");

        assertThat(content, equalTo("{\"control\":\"old-data\"}"));
    }

    @Test
    void throw_domain_not_found_on_get_requirement_versions() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);
        when(accessFilter.getAccessibleNamespaces()).thenReturn(Set.of());

        assertThrows(DomainNotFoundException.class,
                () -> store.getRequirementVersions("nonexistent", 1));
    }

    @Test
    void throw_control_not_found_when_id_does_not_match() {
        RegistryEntry entry = new RegistryEntry(UNIQUE_ID, Path.of("controls/security/my-control.json"),
                RegistryResourceType.CONTROL, "My Control", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:" + UNIQUE_ID, entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.CONTROL)).thenReturn(List.of(entry));
        when(accessFilter.getAccessibleNamespaces()).thenReturn(Set.of("finos"));

        assertThrows(ControlNotFoundException.class,
                () -> store.getRequirementVersions(DOMAIN, 99999));
    }

    @Test
    void throw_domain_not_found_on_get_requirement_for_version() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);
        when(accessFilter.getAccessibleNamespaces()).thenReturn(Set.of());

        assertThrows(DomainNotFoundException.class,
                () -> store.getRequirementForVersion("nonexistent", 1, "abc1234"));
    }

    @Test
    void throw_version_not_found_when_the_requested_version_is_not_sha_shaped() {
        RegistryEntry entry = new RegistryEntry(UNIQUE_ID, Path.of("controls/security/my-control.json"),
                RegistryResourceType.CONTROL, "My Control", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:" + UNIQUE_ID, entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.CONTROL)).thenReturn(List.of(entry));
        when(accessFilter.getAccessibleNamespaces()).thenReturn(Set.of("finos"));

        assertThrows(ControlRequirementVersionNotFoundException.class,
                () -> store.getRequirementForVersion(DOMAIN, HASH_ID, "1.0.0"));
    }

    @Test
    void throw_requirement_version_not_found_when_file_missing() throws Exception {
        RegistryEntry entry = new RegistryEntry(UNIQUE_ID, Path.of("controls/security/nonexistent.json"),
                RegistryResourceType.CONTROL, "My Control", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:" + UNIQUE_ID, entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.CONTROL)).thenReturn(List.of(entry));
        when(accessFilter.getAccessibleNamespaces()).thenReturn(Set.of("finos"));

        when(cloneManager.getRepoForNamespace("finos")).thenReturn("org/repo");
        when(versionService.getFileAtVersion("org/repo", "controls/security/nonexistent.json", "abc1234"))
                .thenReturn(null);

        assertThrows(ControlRequirementVersionNotFoundException.class,
                () -> store.getRequirementForVersion(DOMAIN, HASH_ID, "abc1234"));
    }

    @Test
    void throw_requirement_version_not_found_when_the_local_head_file_is_missing_on_disk(@TempDir Path tempDir) throws Exception {
        RegistryEntry entry = new RegistryEntry(UNIQUE_ID, Path.of("controls/security/nonexistent.json"),
                RegistryResourceType.CONTROL, "My Control", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:" + UNIQUE_ID, entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.CONTROL)).thenReturn(List.of(entry));
        when(accessFilter.getAccessibleNamespaces()).thenReturn(Set.of("finos"));
        when(cloneManager.headSha("finos")).thenReturn("abc1234");

        GitHubControlStore realFileReaderStore = new GitHubControlStore(registryService, cloneManager, versionService,
                new NamespaceFileReader(new GitHubStoreConfig("", tempDir.toString(), "https://api.github.com")),
                accessFilter);

        assertThrows(ControlRequirementVersionNotFoundException.class,
                () -> realFileReaderStore.getRequirementForVersion(DOMAIN, HASH_ID, "abc1234"));
    }

    @Test
    void return_empty_versions_when_the_registry_is_mid_rebuild_between_the_two_lookups() throws Exception {
        // findControlEntry and findNamespaceForControl each re-derive the entry's namespace
        // independently by re-walking the registry - a genuine (if rare) registry-rebuild
        // race can have the entry present for the first walk and gone by the second. This
        // simulates exactly that with consecutive stubbing, rather than a namespace/domain
        // mismatch which is a different scenario entirely.
        RegistryEntry entry = new RegistryEntry(UNIQUE_ID, Path.of("controls/security/my-control.json"),
                RegistryResourceType.CONTROL, "My Control", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:" + UNIQUE_ID, entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.CONTROL))
                .thenReturn(List.of(entry), List.of());
        when(accessFilter.getAccessibleNamespaces()).thenReturn(Set.of("finos"));

        List<String> versions = store.getRequirementVersions(DOMAIN, HASH_ID);

        assertThat(versions, is(empty()));
    }

    @Test
    void throw_requirement_version_not_found_when_the_registry_is_mid_rebuild_between_the_two_lookups() throws Exception {
        RegistryEntry entry = new RegistryEntry(UNIQUE_ID, Path.of("controls/security/my-control.json"),
                RegistryResourceType.CONTROL, "My Control", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:" + UNIQUE_ID, entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.CONTROL))
                .thenReturn(List.of(entry), List.of());
        when(accessFilter.getAccessibleNamespaces()).thenReturn(Set.of("finos"));

        assertThrows(ControlRequirementVersionNotFoundException.class,
                () -> store.getRequirementForVersion(DOMAIN, HASH_ID, "abc1234"));
    }

    @Test
    void throw_unsupported_on_create_control_requirement() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.createControlRequirement(new CreateControlRequirement(), DOMAIN));
    }

    @Test
    void throw_unsupported_on_create_requirement_for_version() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.createRequirementForVersion(DOMAIN, 1, "1.0.0", new CreateControlRequirement()));
    }

    @Test
    void throw_unsupported_on_delete_control_requirement() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.deleteControlRequirement(DOMAIN, 1));
    }

    @Test
    void return_no_configurations_for_a_control_that_has_none() throws Exception {
        // Control configurations have no registry representation at all in GitHub mode -
        // this is a genuine "there are none", not the write-unsupported 501 the old
        // behaviour incorrectly returned for what is a GET-backed read.
        RegistryEntry entry = new RegistryEntry(UNIQUE_ID, Path.of("controls/security/my-control.json"),
                RegistryResourceType.CONTROL, "My Control", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:" + UNIQUE_ID, entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.CONTROL)).thenReturn(List.of(entry));
        when(accessFilter.getAccessibleNamespaces()).thenReturn(Set.of("finos"));

        assertThat(store.getConfigurationsForControl(DOMAIN, HASH_ID), is(empty()));
    }

    @Test
    void throw_control_not_found_on_get_configurations_for_control_when_control_does_not_exist() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);
        when(accessFilter.getAccessibleNamespaces()).thenReturn(Set.of());

        assertThrows(DomainNotFoundException.class,
                () -> store.getConfigurationsForControl(DOMAIN, 1));
    }

    @Test
    void return_no_configuration_details_for_a_control_that_has_none() throws Exception {
        RegistryEntry entry = new RegistryEntry(UNIQUE_ID, Path.of("controls/security/my-control.json"),
                RegistryResourceType.CONTROL, "My Control", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:" + UNIQUE_ID, entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.CONTROL)).thenReturn(List.of(entry));
        when(accessFilter.getAccessibleNamespaces()).thenReturn(Set.of("finos"));

        assertThat(store.getConfigurationDetailsForControl(DOMAIN, HASH_ID), is(empty()));
    }

    @Test
    void throw_unsupported_on_create_control_configuration() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.createControlConfiguration(new CreateControlConfiguration(), DOMAIN, 1));
    }

    @Test
    void throw_unsupported_on_delete_control_configuration() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.deleteControlConfiguration(DOMAIN, 1, 1));
    }

    @Test
    void throw_configuration_not_found_on_get_configuration_versions() throws Exception {
        RegistryEntry entry = new RegistryEntry(UNIQUE_ID, Path.of("controls/security/my-control.json"),
                RegistryResourceType.CONTROL, "My Control", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:" + UNIQUE_ID, entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.CONTROL)).thenReturn(List.of(entry));
        when(accessFilter.getAccessibleNamespaces()).thenReturn(Set.of("finos"));

        assertThrows(ControlConfigurationNotFoundException.class,
                () -> store.getConfigurationVersions(DOMAIN, HASH_ID, 1));
    }

    @Test
    void throw_configuration_not_found_on_get_configuration_for_version() throws Exception {
        RegistryEntry entry = new RegistryEntry(UNIQUE_ID, Path.of("controls/security/my-control.json"),
                RegistryResourceType.CONTROL, "My Control", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:" + UNIQUE_ID, entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.CONTROL)).thenReturn(List.of(entry));
        when(accessFilter.getAccessibleNamespaces()).thenReturn(Set.of("finos"));

        assertThrows(ControlConfigurationNotFoundException.class,
                () -> store.getConfigurationForVersion(DOMAIN, HASH_ID, 1, "1.0.0"));
    }

    @Test
    void throw_unsupported_on_create_configuration_for_version() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.createConfigurationForVersion(DOMAIN, 1, 1, "1.0.0", new CreateControlConfiguration()));
    }

    @Test
    void throw_domain_not_found_rather_than_a_cross_domain_match_when_domain_does_not_exist() throws Exception {
        // A control with this exact hash id genuinely exists, but only in the "payments"
        // domain - requesting it under a domain that doesn't exist anywhere in the
        // registry must 404 on the domain, never fall through to returning a different
        // domain's control just because the id happened to match.
        RegistryEntry entry = new RegistryEntry(UNIQUE_ID, Path.of("controls/payments/my-control.json"),
                RegistryResourceType.CONTROL, "My Control", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:" + UNIQUE_ID, entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.CONTROL)).thenReturn(List.of(entry));
        when(accessFilter.getAccessibleNamespaces()).thenReturn(Set.of("finos"));

        assertThrows(DomainNotFoundException.class,
                () -> store.getRequirementVersions("nonexistent-domain", HASH_ID));
    }
}
