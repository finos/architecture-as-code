package org.finos.calm.store.github.registry;

import org.junit.jupiter.api.Test;

import java.nio.file.Path;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.nullValue;

class TestResourcePathHelperShould {

    @Test
    void derive_the_stem_from_before_the_first_dot() {
        assertThat(ResourcePathHelper.stem(Path.of("patterns/foo.calm.json")), equalTo("foo"));
        assertThat(ResourcePathHelper.stem(Path.of("foo.json")), equalTo("foo"));
        assertThat(ResourcePathHelper.stem(Path.of("foo")), equalTo("foo"));
    }

    @Test
    void derive_the_variant_from_a_compound_extension_only() {
        assertThat(ResourcePathHelper.variant(Path.of("patterns/foo.calm.json")), equalTo("calm"));
        assertThat(ResourcePathHelper.variant(Path.of("foo.standard.json")), equalTo("standard"));
        assertThat(ResourcePathHelper.variant(Path.of("foo.json")), nullValue());
    }

    @Test
    void drop_the_first_known_type_folder_from_the_path() {
        assertThat(ResourcePathHelper.path(Path.of("patterns/a/foo.json")), equalTo("a"));
        assertThat(ResourcePathHelper.path(Path.of("a/patterns/b/foo.json")), equalTo("a/b"));
        assertThat(ResourcePathHelper.path(Path.of("a/b/foo.json")), equalTo("a/b"));
        assertThat(ResourcePathHelper.path(Path.of("foo.json")), nullValue());
    }

    @Test
    void find_the_first_known_type_folder_or_fall_back_to_the_parent() {
        assertThat(ResourcePathHelper.typeRoot(Path.of("a/patterns/b/foo.json")), equalTo("patterns"));
        assertThat(ResourcePathHelper.typeRoot(Path.of("team/foo.json")), equalTo("team"));
        assertThat(ResourcePathHelper.typeRoot(Path.of("foo.json")), nullValue());
    }

    @Test
    void tolerate_null_paths() {
        assertThat(ResourcePathHelper.stem(null), nullValue());
        assertThat(ResourcePathHelper.variant(null), nullValue());
        assertThat(ResourcePathHelper.path(null), nullValue());
        assertThat(ResourcePathHelper.typeRoot(null), nullValue());
    }
}
