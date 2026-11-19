package org.finos.calm.store.github.registry;

import org.junit.jupiter.api.Test;

import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.equalTo;

class TestRegistrySnapshotFindShould {

    private final RegistryEntry plain = entry("api", "patterns/api.json");
    private final RegistryEntry variant = entry("api", "patterns/aws/api.calm.json");
    private final RegistryEntry other = entry("web", "patterns/web.json");

    private final RegistrySnapshot snapshot = new RegistrySnapshot(
            Map.of("finos", List.of(plain, variant, other)), Map.of());

    @Test
    void match_the_stem_and_ignore_unsupplied_parts() {
        assertThat(snapshot.find("finos", null, "api", null, null), contains(plain, variant));
    }

    @Test
    void narrow_by_path_and_variant() {
        assertThat(snapshot.find("finos", null, "api", "aws", "calm"), contains(variant));
        assertThat(snapshot.find("finos", null, "api", null, "calm"), contains(variant));
        assertThat(snapshot.find("finos", null, "api", "aws", null), contains(variant));
    }

    @Test
    void narrow_by_type_and_namespace() {
        assertThat(snapshot.find("finos", RegistryResourceType.PATTERN, "web", null, null), contains(other));
        assertThat(snapshot.find("finos", RegistryResourceType.FLOW, "web", null, null), empty());
        assertThat(snapshot.find("missing", null, "web", null, null), empty());
    }

    private RegistryEntry entry(String stem, String path) {
        return new RegistryEntry(stem, Path.of(path), RegistryResourceType.PATTERN, stem, Instant.now());
    }
}
