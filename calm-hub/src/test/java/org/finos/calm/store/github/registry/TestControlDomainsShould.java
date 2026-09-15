package org.finos.calm.store.github.registry;

import org.junit.jupiter.api.Test;

import java.nio.file.Path;
import java.time.Instant;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;

class TestControlDomainsShould {

    @Test
    void extract_the_second_path_segment_as_the_domain_under_controls() {
        RegistryEntry entry = new RegistryEntry("access-control", Path.of("controls/security/access-control.json"),
                RegistryResourceType.CONTROL, "Access Control", Instant.now());

        assertThat(ControlDomains.extractDomain(entry), equalTo("security"));
    }

    @Test
    void return_default_when_the_path_is_not_under_controls() {
        RegistryEntry entry = new RegistryEntry("core", Path.of("standards/security/core.json"),
                RegistryResourceType.STANDARD, "Core", Instant.now());

        assertThat(ControlDomains.extractDomain(entry), equalTo("default"));
    }

    @Test
    void return_default_when_the_path_has_fewer_than_two_segments() {
        RegistryEntry entry = new RegistryEntry("controls", Path.of("controls.json"),
                RegistryResourceType.CONTROL, "Controls", Instant.now());

        assertThat(ControlDomains.extractDomain(entry), equalTo("default"));
    }

    @Test
    void treat_a_direct_childs_filename_as_the_domain_when_controls_has_no_domain_subdirectory() {
        // extractDomain takes the second path segment unconditionally once the first is
        // "controls" - it doesn't distinguish a domain subdirectory from a file placed
        // directly under controls/, so this is exactly what it returns today (including
        // the .json suffix), not "default".
        RegistryEntry entry = new RegistryEntry("root-control", Path.of("controls/root-control.json"),
                RegistryResourceType.CONTROL, "Root Control", Instant.now());

        assertThat(ControlDomains.extractDomain(entry), equalTo("root-control.json"));
    }
}
