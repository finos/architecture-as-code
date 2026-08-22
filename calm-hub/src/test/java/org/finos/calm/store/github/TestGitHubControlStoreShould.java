package org.finos.calm.store.github;

import org.finos.calm.domain.controls.ControlDetail;
import org.finos.calm.domain.controls.CreateControlConfiguration;
import org.finos.calm.domain.controls.CreateControlRequirement;
import org.finos.calm.store.github.util.InMemoryRegistryService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;

@ExtendWith(MockitoExtension.class)
class TestGitHubControlStoreShould {

    @Mock
    private InMemoryRegistryService registryService;

    private GitHubControlStore store;

    @BeforeEach
    void setup() {
        store = new GitHubControlStore(registryService);
    }

    @Test
    void return_empty_controls_for_domain() throws Exception {
        List<ControlDetail> result = store.getControlsForDomain("security");

        assertThat(result, is(empty()));
    }

    @Test
    void throw_unsupported_on_create_control_requirement() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.createControlRequirement(new CreateControlRequirement(), "security"));
    }

    @Test
    void throw_unsupported_on_get_requirement_versions() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.getRequirementVersions("security", 1));
    }

    @Test
    void throw_unsupported_on_get_requirement_for_version() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.getRequirementForVersion("security", 1, "1.0.0"));
    }

    @Test
    void throw_unsupported_on_create_requirement_for_version() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.createRequirementForVersion("security", 1, "1.0.0", new CreateControlRequirement()));
    }

    @Test
    void throw_unsupported_on_get_configurations_for_control() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.getConfigurationsForControl("security", 1));
    }

    @Test
    void throw_unsupported_on_get_configuration_details_for_control() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.getConfigurationDetailsForControl("security", 1));
    }

    @Test
    void throw_unsupported_on_create_control_configuration() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.createControlConfiguration(new CreateControlConfiguration(), "security", 1));
    }

    @Test
    void throw_unsupported_on_get_configuration_versions() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.getConfigurationVersions("security", 1, 1));
    }

    @Test
    void throw_unsupported_on_get_configuration_for_version() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.getConfigurationForVersion("security", 1, 1, "1.0.0"));
    }

    @Test
    void throw_unsupported_on_create_configuration_for_version() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.createConfigurationForVersion("security", 1, 1, "1.0.0", new CreateControlConfiguration()));
    }
}
