package org.finos.calm.domain;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;

class TestResourceVersionShould {

    @Test
    void recognise_a_snapshot_version() {
        assertThat(ResourceVersion.isSnapshot("1.0.0-SNAPSHOT"), is(true));
    }

    @ParameterizedTest
    @ValueSource(strings = {"1.0.0", "1-0-0", "100", "2.13.7"})
    void not_treat_a_release_version_as_a_snapshot(String release) {
        assertThat(ResourceVersion.isSnapshot(release), is(false));
    }

    @Test
    void reject_a_lowercase_suffix() {
        // The suffix is a fixed token, not a free-form label. Accepting case variants would
        // let 1.0.0-snapshot and 1.0.0-SNAPSHOT become two documents for one logical version.
        assertThat(ResourceVersion.isSnapshot("1.0.0-snapshot"), is(false));
    }

    @Test
    void not_treat_a_bare_suffix_as_a_snapshot() {
        // "-SNAPSHOT" with no version in front is not a version at all.
        assertThat(ResourceVersion.isSnapshot("-SNAPSHOT"), is(false));
    }

    @Test
    void treat_a_null_version_as_not_a_snapshot() {
        // listVersions reads the version field straight out of a document, so an absent
        // field arrives here as null. Throwing would make a listing endpoint fail.
        assertThat(ResourceVersion.isSnapshot(null), is(false));
    }

    @Test
    void strip_the_suffix_to_give_the_release_version() {
        assertThat(ResourceVersion.releaseVersion("1.0.0-SNAPSHOT"), is("1.0.0"));
    }

    @Test
    void leave_a_release_version_unchanged_when_stripping() {
        assertThat(ResourceVersion.releaseVersion("1.0.0"), is("1.0.0"));
    }

    @Test
    void pass_null_through_when_stripping() {
        assertThat(ResourceVersion.releaseVersion(null), is(nullValue()));
    }

    @Test
    void add_the_suffix_to_a_release_version() {
        assertThat(ResourceVersion.asSnapshot("1.0.0"), is("1.0.0-SNAPSHOT"));
    }

    @Test
    void not_double_the_suffix_on_a_version_that_already_has_one() {
        assertThat(ResourceVersion.asSnapshot("1.0.0-SNAPSHOT"), is("1.0.0-SNAPSHOT"));
    }

    @Test
    void preserve_the_original_spelling_when_stripping() {
        // Canonicalisation is CanonicalVersion's job, not this class's. Folding here as well
        // would put the same rule in two places, which is how they drift apart.
        assertThat(ResourceVersion.releaseVersion("1-0-0-SNAPSHOT"), is("1-0-0"));
    }
}
