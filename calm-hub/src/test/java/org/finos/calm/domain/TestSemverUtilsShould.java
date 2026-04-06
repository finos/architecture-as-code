package org.finos.calm.domain;

import org.junit.jupiter.api.Test;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;

public class TestSemverUtilsShould {

    @Test
    void bump_major_version() {
        assertThat(SemverUtils.bumpVersion("1.2.3", "MAJOR"), is("2.0.0"));
    }

    @Test
    void bump_minor_version() {
        assertThat(SemverUtils.bumpVersion("1.2.3", "MINOR"), is("1.3.0"));
    }

    @Test
    void bump_patch_version() {
        assertThat(SemverUtils.bumpVersion("1.2.3", "PATCH"), is("1.2.4"));
    }

    @Test
    void bump_major_from_zero() {
        assertThat(SemverUtils.bumpVersion("0.0.1", "MAJOR"), is("1.0.0"));
    }

    @Test
    void bump_minor_from_zero() {
        assertThat(SemverUtils.bumpVersion("0.0.1", "MINOR"), is("0.1.0"));
    }

    @Test
    void bump_patch_from_initial_version() {
        assertThat(SemverUtils.bumpVersion("1.0.0", "PATCH"), is("1.0.1"));
    }

    @Test
    void handle_case_insensitive_change_type() {
        assertThat(SemverUtils.bumpVersion("1.0.0", "major"), is("2.0.0"));
        assertThat(SemverUtils.bumpVersion("1.0.0", "Minor"), is("1.1.0"));
        assertThat(SemverUtils.bumpVersion("1.0.0", "patch"), is("1.0.1"));
    }

    @Test
    void handle_hyphen_version_format() {
        assertThat(SemverUtils.bumpVersion("1-2-3", "PATCH"), is("1.2.4"));
    }

    @Test
    void throw_for_invalid_change_type() {
        assertThrows(IllegalArgumentException.class,
                () -> SemverUtils.bumpVersion("1.0.0", "INVALID"));
    }

    @Test
    void throw_for_invalid_version_format() {
        assertThrows(IllegalArgumentException.class,
                () -> SemverUtils.bumpVersion("1.0", "MAJOR"));
    }

    @Test
    void parse_sortable_version_correctly() {
        assertThat(SemverUtils.parseSortableVersion("1.0.0"), is(1_000_000L));
        assertThat(SemverUtils.parseSortableVersion("1.2.3"), is(1_002_003L));
        assertThat(SemverUtils.parseSortableVersion("2.0.0"), is(2_000_000L));
    }

    @Test
    void sort_versions_correctly() {
        assertThat(SemverUtils.parseSortableVersion("2.0.0") > SemverUtils.parseSortableVersion("1.9.9"), is(true));
        assertThat(SemverUtils.parseSortableVersion("1.1.0") > SemverUtils.parseSortableVersion("1.0.9"), is(true));
    }

    @Test
    void return_zero_for_invalid_version_in_parse() {
        assertThat(SemverUtils.parseSortableVersion("invalid"), is(0L));
    }
}
