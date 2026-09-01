package org.finos.calm.store.github;

import org.finos.calm.domain.controls.ControlDetail;
import org.finos.calm.domain.controls.CreateControlConfiguration;
import org.finos.calm.domain.controls.CreateControlRequirement;
import org.finos.calm.domain.exception.ControlNotFoundException;
import org.finos.calm.domain.exception.ControlRequirementVersionNotFoundException;
import org.finos.calm.domain.exception.DomainNotFoundException;
import org.finos.calm.store.github.util.CalmResourceType;
import org.finos.calm.store.github.util.GitHubCloneManager;
import org.finos.calm.store.github.util.GitHubVersionService;
import org.finos.calm.store.github.util.InMemoryRegistryService;
import org.finos.calm.store.github.util.RegistryEntry;
import org.finos.calm.store.github.util.RegistrySnapshot;
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

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestGitHubControlStoreShould {

    private static final String DOMAIN = "security";
    private static final String UNIQUE_ID = "my-control";
    private static final int HASH_ID = UNIQUE_ID.hashCode() & 0x7FFFFFFF;

    @Mock
    private InMemoryRegistryService registryService;

    private GitHubControlStore store;

    @BeforeEach
    void setup() {
        store = new GitHubControlStore(registryService);
    }

    @Test
    void return_controls_for_domain() throws Exception {
        RegistryEntry entry = new RegistryEntry(UNIQUE_ID, Path.of("controls/security/my-control.json"),
                CalmResourceType.CONTROL, "My Control", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of(DOMAIN, List.of(entry)),
                Map.of(DOMAIN + ":" + UNIQUE_ID, entry),
                Map.of(CalmResourceType.CONTROL, List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType(DOMAIN, CalmResourceType.CONTROL)).thenReturn(List.of(entry));

        List<ControlDetail> result = store.getControlsForDomain(DOMAIN);

        assertThat(result, hasSize(1));
        assertThat(result.get(0).getName(), equalTo(UNIQUE_ID));
        assertThat(result.get(0).getTitle(), equalTo("My Control"));
        assertThat(result.get(0).getId(), equalTo(HASH_ID));
    }

    @Test
    void throw_domain_not_found_when_domain_missing_on_get_controls() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);

        assertThrows(DomainNotFoundException.class,
                () -> store.getControlsForDomain("nonexistent"));
    }

    @Test
    void return_versions_list_for_existing_control() throws Exception {
        RegistryEntry entry = new RegistryEntry(UNIQUE_ID, Path.of("controls/my-control.json"),
                CalmResourceType.CONTROL, "My Control", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of(DOMAIN, List.of(entry)),
                Map.of(DOMAIN + ":" + UNIQUE_ID, entry),
                Map.of(CalmResourceType.CONTROL, List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType(DOMAIN, CalmResourceType.CONTROL)).thenReturn(List.of(entry));

        List<String> versions = store.getRequirementVersions(DOMAIN, HASH_ID);

        assertThat(versions, hasSize(1));
        assertThat(versions.get(0), equalTo("latest"));
    }

    @Test
    void return_sha_versions_when_version_service_available() throws Exception {
        RegistryEntry entry = new RegistryEntry(UNIQUE_ID, Path.of("controls/my-control.json"),
                CalmResourceType.CONTROL, "My Control", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of(DOMAIN, List.of(entry)),
                Map.of(DOMAIN + ":" + UNIQUE_ID, entry),
                Map.of(CalmResourceType.CONTROL, List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType(DOMAIN, CalmResourceType.CONTROL)).thenReturn(List.of(entry));

        GitHubCloneManager mockCloneManager = mock(GitHubCloneManager.class);
        GitHubVersionService mockVersionService = mock(GitHubVersionService.class);
        store.cloneManager = mockCloneManager;
        store.versionService = mockVersionService;

        when(mockCloneManager.getRepoForNamespace(DOMAIN)).thenReturn("org/repo");
        when(mockVersionService.getFileVersions("org/repo", "controls/my-control.json"))
                .thenReturn(List.of("abc1234", "def5678"));

        List<String> versions = store.getRequirementVersions(DOMAIN, HASH_ID);

        assertThat(versions, hasSize(2));
        assertThat(versions.get(0), equalTo("abc1234"));
    }

    @Test
    void return_control_content_for_version(@TempDir Path tempDir) throws Exception {
        Path controlDir = tempDir.resolve("security/controls");
        Files.createDirectories(controlDir);
        Files.writeString(controlDir.resolve("my-control.json"), "{\"control\":\"data\"}");

        RegistryEntry entry = new RegistryEntry(UNIQUE_ID, Path.of("controls/my-control.json"),
                CalmResourceType.CONTROL, "My Control", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of(DOMAIN, List.of(entry)),
                Map.of(DOMAIN + ":" + UNIQUE_ID, entry),
                Map.of(CalmResourceType.CONTROL, List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType(DOMAIN, CalmResourceType.CONTROL)).thenReturn(List.of(entry));

        store.cloneDirectory = tempDir.toString();
        String content = store.getRequirementForVersion(DOMAIN, HASH_ID, "1.0.0");

        assertThat(content, equalTo("{\"control\":\"data\"}"));
    }

    @Test
    void return_content_from_github_api_for_sha_version() throws Exception {
        RegistryEntry entry = new RegistryEntry(UNIQUE_ID, Path.of("controls/my-control.json"),
                CalmResourceType.CONTROL, "My Control", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of(DOMAIN, List.of(entry)),
                Map.of(DOMAIN + ":" + UNIQUE_ID, entry),
                Map.of(CalmResourceType.CONTROL, List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType(DOMAIN, CalmResourceType.CONTROL)).thenReturn(List.of(entry));

        GitHubCloneManager mockCloneManager = mock(GitHubCloneManager.class);
        GitHubVersionService mockVersionService = mock(GitHubVersionService.class);
        store.cloneManager = mockCloneManager;
        store.versionService = mockVersionService;

        when(mockCloneManager.getRepoForNamespace(DOMAIN)).thenReturn("org/repo");
        when(mockVersionService.getFileAtVersion("org/repo", "controls/my-control.json", "abc1234"))
                .thenReturn("{\"control\":\"old-data\"}");

        String content = store.getRequirementForVersion(DOMAIN, HASH_ID, "abc1234");

        assertThat(content, equalTo("{\"control\":\"old-data\"}"));
    }

    @Test
    void throw_domain_not_found_on_get_requirement_versions() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);

        assertThrows(DomainNotFoundException.class,
                () -> store.getRequirementVersions("nonexistent", 1));
    }

    @Test
    void throw_control_not_found_when_id_does_not_match() {
        RegistryEntry entry = new RegistryEntry(UNIQUE_ID, Path.of("controls/security/my-control.json"),
                CalmResourceType.CONTROL, "My Control", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of(DOMAIN, List.of(entry)),
                Map.of(DOMAIN + ":" + UNIQUE_ID, entry),
                Map.of(CalmResourceType.CONTROL, List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType(DOMAIN, CalmResourceType.CONTROL)).thenReturn(List.of(entry));

        assertThrows(ControlNotFoundException.class,
                () -> store.getRequirementVersions(DOMAIN, 99999));
    }

    @Test
    void throw_domain_not_found_on_get_requirement_for_version() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);

        assertThrows(DomainNotFoundException.class,
                () -> store.getRequirementForVersion("nonexistent", 1, "1.0.0"));
    }

    @Test
    void throw_requirement_version_not_found_when_file_missing(@TempDir Path tempDir) throws Exception {
        RegistryEntry entry = new RegistryEntry(UNIQUE_ID, Path.of("controls/nonexistent.json"),
                CalmResourceType.CONTROL, "My Control", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of(DOMAIN, List.of(entry)),
                Map.of(DOMAIN + ":" + UNIQUE_ID, entry),
                Map.of(CalmResourceType.CONTROL, List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType(DOMAIN, CalmResourceType.CONTROL)).thenReturn(List.of(entry));

        store.cloneDirectory = tempDir.toString();

        assertThrows(ControlRequirementVersionNotFoundException.class,
                () -> store.getRequirementForVersion(DOMAIN, HASH_ID, "1.0.0"));
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
    void throw_unsupported_on_get_configurations_for_control() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.getConfigurationsForControl(DOMAIN, 1));
    }

    @Test
    void throw_unsupported_on_get_configuration_details_for_control() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.getConfigurationDetailsForControl(DOMAIN, 1));
    }

    @Test
    void throw_unsupported_on_create_control_configuration() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.createControlConfiguration(new CreateControlConfiguration(), DOMAIN, 1));
    }

    @Test
    void throw_unsupported_on_get_configuration_versions() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.getConfigurationVersions(DOMAIN, 1, 1));
    }

    @Test
    void throw_unsupported_on_get_configuration_for_version() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.getConfigurationForVersion(DOMAIN, 1, 1, "1.0.0"));
    }

    @Test
    void throw_unsupported_on_create_configuration_for_version() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.createConfigurationForVersion(DOMAIN, 1, 1, "1.0.0", new CreateControlConfiguration()));
    }
}
