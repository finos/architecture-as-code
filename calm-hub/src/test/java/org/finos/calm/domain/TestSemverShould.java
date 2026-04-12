package org.finos.calm.domain;

import org.finos.calm.domain.frontcontroller.ChangeType;
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
}
