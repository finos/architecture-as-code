package org.finos.calm.store.github;

import org.finos.calm.domain.Pattern;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.domain.pattern.CreatePatternRequest;
import org.finos.calm.store.PageRequest;
import org.finos.calm.store.github.util.CalmResourceType;
import org.finos.calm.store.github.util.InMemoryRegistryService;
import org.finos.calm.store.github.util.RegistryEntry;
import org.finos.calm.store.github.util.RegistrySnapshot;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestGitHubPatternStoreShould {

    @Mock
    private InMemoryRegistryService registryService;

    private GitHubPatternStore store;

    @BeforeEach
    void setup() {
        store = new GitHubPatternStore(registryService);
    }

    @Test
    void return_patterns_for_namespace() throws NamespaceNotFoundException {
        RegistryEntry entry = new RegistryEntry("event-driven", Path.of("patterns/event-driven.json"),
                CalmResourceType.PATTERN, "Event Driven", Instant.now());

        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:event-driven", entry),
                Map.of(CalmResourceType.PATTERN, List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", CalmResourceType.PATTERN)).thenReturn(List.of(entry));

        List<NamespaceResourceSummary> result = store.getPatternsForNamespace("finos", PageRequest.UNPAGED);

        assertThat(result, hasSize(1));
        assertThat(result.get(0).getName(), equalTo("Event Driven"));
    }

    @Test
    void throw_namespace_not_found_when_namespace_missing() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.getPatternsForNamespace("nonexistent", PageRequest.UNPAGED));
    }

    @Test
    void throw_unsupported_on_create_pattern() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.createPatternForNamespace(new CreatePatternRequest(), "finos"));
    }

    @Test
    void throw_unsupported_on_create_pattern_for_version() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.createPatternForVersion(new Pattern.PatternBuilder().build()));
    }

    @Test
    void throw_unsupported_on_update_pattern_for_version() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.updatePatternForVersion(new Pattern.PatternBuilder().build()));
    }

    @Test
    void throw_unsupported_on_get_pattern_versions() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.getPatternVersions(new Pattern.PatternBuilder().build()));
    }

    @Test
    void throw_unsupported_on_get_pattern_for_version() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.getPatternForVersion(new Pattern.PatternBuilder().build()));
    }
}
