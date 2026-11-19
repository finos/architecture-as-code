package org.finos.calm.store.github.registry;

import org.finos.calm.domain.exception.AmbiguousResourceIdException;
import org.junit.jupiter.api.Test;

import java.nio.file.Path;
import java.time.Instant;
import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertThrows;

class TestRegistryLookupShould {

    private final RegistryEntry entry = new RegistryEntry(
            "foo", Path.of("patterns/foo.json"), RegistryResourceType.PATTERN, "Foo", Instant.now());

    @Test
    void return_null_when_nothing_matches() {
        assertThat(RegistryLookup.singleOrNull(List.of()), nullValue());
        assertThat(RegistryLookup.singleOrNull(null), nullValue());
    }

    @Test
    void return_the_only_match() {
        assertThat(RegistryLookup.singleOrNull(List.of(entry)), equalTo(entry));
    }

    @Test
    void fail_closed_when_the_id_is_ambiguous() {
        assertThrows(AmbiguousResourceIdException.class,
                () -> RegistryLookup.singleOrNull(List.of(entry, entry)));
    }
}
