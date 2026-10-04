package org.finos.calm.domain;

import org.finos.calm.domain.mapping.ChangeType;
import org.junit.jupiter.api.Test;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.greaterThan;
import static org.junit.jupiter.api.Assertions.assertThrows;

public class TestSemverShould {

    @Test
    void bump_major_version() {
        assertThat(Semver.parse("1.2.3").bump(ChangeType.MAJOR).toString(), is("2.0.0"));
    }

    @Test
    void bump_minor_version() {
        assertThat(Semver.parse("1.2.3").bump(ChangeType.MINOR).toString(), is("1.3.0"));
    }

    @Test
    void bump_patch_version() {
        assertThat(Semver.parse("1.2.3").bump(ChangeType.PATCH).toString(), is("1.2.4"));
    }

    @Test
    void bump_major_from_zero() {
        assertThat(Semver.parse("0.0.1").bump(ChangeType.MAJOR).toString(), is("1.0.0"));
    }

    @Test
    void bump_minor_from_zero() {
        assertThat(Semver.parse("0.0.1").bump(ChangeType.MINOR).toString(), is("0.1.0"));
    }

    @Test
    void bump_patch_from_initial_version() {
        assertThat(Semver.parse("1.0.0").bump(ChangeType.PATCH).toString(), is("1.0.1"));
    }

    @Test
    void handle_hyphen_version_format() {
        assertThat(Semver.parse("1-2-3").bump(ChangeType.PATCH).toString(), is("1.2.4"));
    }

    @Test
    void throw_for_invalid_version_format() {
        assertThrows(IllegalArgumentException.class, () -> Semver.parse("1.0"));
    }

    @Test
    void parse_into_components() {
        Semver v = Semver.parse("1.2.3");
        assertThat(v.major(), is(1));
        assertThat(v.minor(), is(2));
        assertThat(v.patch(), is(3));
    }

    @Test
    void compare_versions_correctly() {
        assertThat(Semver.parse("2.0.0"), is(greaterThan(Semver.parse("1.9.9"))));
        assertThat(Semver.parse("1.1.0"), is(greaterThan(Semver.parse("1.0.9"))));
    }

    @Test
    void return_zero_semver_for_invalid_version_in_tryParse() {
        assertThat(Semver.tryParse("invalid"), is(new Semver(0, 0, 0)));
    }

    @Test
    void format_as_dot_separated_string() {
        assertThat(Semver.parse("1.2.3").toString(), is("1.2.3"));
    }

    @Test
    void parse_a_snapshot_as_its_release_version() {
        assertThat(Semver.tryParse("1.0.0-SNAPSHOT"), is(new Semver(1, 0, 0)));
    }

    @Test
    void parse_a_dashed_snapshot_as_its_release_version() {
        // The suffix must be removed before the '-' to '.' replacement that makes the dashed
        // form parse. Removing it afterwards yields "1.0.0.SNAPSHOT" — four segments, which
        // collapses to 0.0.0 and sorts lowest. That is the ADR revision 100 bug.
        assertThat(Semver.tryParse("1-0-0-SNAPSHOT"), is(new Semver(1, 0, 0)));
    }

    @Test
    void still_parse_the_dashed_release_form() {
        assertThat(Semver.tryParse("1-10-0"), is(new Semver(1, 10, 0)));
    }

    @Test
    void still_collapse_a_genuinely_unparseable_version() {
        assertThat(Semver.tryParse("not-a-version"), is(new Semver(0, 0, 0)));
    }

    @Test
    void accept_a_snapshot_in_the_throwing_parse() {
        // ArchitectureTimelineService uses parse() to classify versions as semver or not.
        // A snapshot that threw would be classified non-semver and pushed to the end of
        // every implied timeline.
        assertThat(Semver.parse("2.3.4-SNAPSHOT"), is(new Semver(2, 3, 4)));
    }
}
