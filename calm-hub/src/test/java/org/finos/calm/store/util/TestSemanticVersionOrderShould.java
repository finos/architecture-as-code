package org.finos.calm.store.util;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;

class TestSemanticVersionOrderShould {

    // Arrays.asList rather than List.of: the latter rejects null elements, and a null
    // version is one of the malformed inputs this comparator has to survive.
    private static List<String> sorted(String... versions) {
        List<String> sorted = new ArrayList<>(Arrays.asList(versions));
        sorted.sort(SemanticVersionOrder.ASCENDING);
        return sorted;
    }

    @Test
    void order_by_major_then_minor_then_patch() {
        assertThat(sorted("2.0.0", "1.1.0", "1.0.1", "1.0.0"),
                contains("1.0.0", "1.0.1", "1.1.0", "2.0.0"));
    }

    @Test
    void order_numerically_rather_than_lexicographically() {
        // The whole reason this class exists: a plain string sort puts 1.10.0 before 1.9.0.
        assertThat(sorted("1.10.0", "1.9.0", "1.2.0"),
                contains("1.2.0", "1.9.0", "1.10.0"));
    }

    @Test
    void order_double_digit_major_versions_numerically() {
        assertThat(sorted("10.0.0", "9.0.0", "2.0.0"),
                contains("2.0.0", "9.0.0", "10.0.0"));
    }

    @Test
    void not_let_a_large_patch_outrank_a_higher_minor() {
        // Guards the segment-by-segment comparison: packing segments into one integer
        // would let a big patch number overflow into the minor version's range.
        assertThat(sorted("1.1.0", "1.0.999999"),
                contains("1.0.999999", "1.1.0"));
    }

    @Test
    void order_dash_encoded_versions_numerically_too() {
        // VERSION_REGEX accepts dashes from the API, so they can reach a store even though
        // ADR 0002 has the new collections storing dots. Treating "1-10-0" as malformed
        // would silently sort it below every real version.
        assertThat(sorted("1-10-0", "1-9-0", "1-2-0"),
                contains("1-2-0", "1-9-0", "1-10-0"));
    }

    @Test
    void rank_the_two_separators_as_the_same_version() {
        // Same version, two spellings: they must rank equally rather than one being
        // demoted to 0.0.0. Only the string tiebreak then separates them.
        assertThat(sorted("1.0.0", "2-0-0", "1-0-0", "2.0.0"),
                contains("1-0-0", "1.0.0", "2-0-0", "2.0.0"));
    }

    @Test
    void sort_unparseable_versions_first_rather_than_throwing() {
        assertThat(sorted("1.0.0", "not-a-version"),
                contains("not-a-version", "1.0.0"));
    }

    @Test
    void sort_versions_with_the_wrong_segment_count_first_rather_than_throwing() {
        assertThat(sorted("1.0.0", "1.0", "1.0.0.0"),
                contains("1.0", "1.0.0.0", "1.0.0"));
    }

    @Test
    void sort_a_non_numeric_segment_first_rather_than_throwing() {
        // Distinct from the wrong-segment-count case: this has exactly three segments, so
        // it gets as far as parsing them and has to survive the parse failing.
        assertThat(sorted("1.0.0", "1.x.0"), contains("1.x.0", "1.0.0"));
    }

    @Test
    void ignore_earlier_segments_of_a_version_whose_later_segment_is_non_numeric() {
        // A partially-parsed version must not rank on its valid leading segments — 9.0.x
        // would otherwise outrank every real 1.x.y release.
        assertThat(sorted("1.0.0", "9.0.x"), contains("9.0.x", "1.0.0"));
    }

    @Test
    void order_equal_ranking_values_deterministically() {
        // Two unparseable values both rank as 0.0.0 — the string tiebreak keeps the
        // overall order total, so sorting is stable rather than arbitrary.
        assertThat(sorted("zzz", "aaa"), contains("aaa", "zzz"));
    }

    @Test
    void treat_identical_versions_as_equal() {
        assertThat(SemanticVersionOrder.ASCENDING.compare("1.2.3", "1.2.3"), is(0));
    }

    @Test
    void sort_a_null_version_first_rather_than_throwing() {
        // listVersions reads the version field straight out of a stored document, so a
        // document missing that field arrives here as null. One malformed row must not
        // fail the whole listing.
        assertThat(sorted("1.0.0", null), contains(null, "1.0.0"));
    }

    @Test
    void treat_two_null_versions_as_equal() {
        assertThat(SemanticVersionOrder.ASCENDING.compare(null, null), is(0));
    }

    @Test
    void rank_a_snapshot_below_its_release() {
        // Standard semver pre-release ordering. Under the shadowing rule the two cannot
        // coexist, so this is defensive — but leaving it unspecified is how a version ends
        // up sorting as 0.0.0.
        List<String> versions = new ArrayList<>(List.of("1.0.0", "1.0.0-SNAPSHOT"));
        versions.sort(SemanticVersionOrder.ASCENDING);
        assertThat(versions, contains("1.0.0-SNAPSHOT", "1.0.0"));
    }

    @Test
    void sort_a_snapshot_into_position_rather_than_last() {
        // Before the Semver fix a snapshot parsed as 0.0.0 and sorted first, so the last
        // element of a sorted list — the "latest" version — could be stale content.
        List<String> versions = new ArrayList<>(List.of("2.0.0", "1.0.0", "1.5.0-SNAPSHOT"));
        versions.sort(SemanticVersionOrder.ASCENDING);
        assertThat(versions, contains("1.0.0", "1.5.0-SNAPSHOT", "2.0.0"));
    }

    @Test
    void order_two_snapshots_by_their_release_versions() {
        List<String> versions = new ArrayList<>(List.of("1.10.0-SNAPSHOT", "1.9.0-SNAPSHOT"));
        versions.sort(SemanticVersionOrder.ASCENDING);
        assertThat(versions, contains("1.9.0-SNAPSHOT", "1.10.0-SNAPSHOT"));
    }

    @Test
    void resolve_latest_release_to_null_for_a_null_or_empty_list() {
        assertThat(SemanticVersionOrder.latestRelease(null), is(nullValue()));
        assertThat(SemanticVersionOrder.latestRelease(List.of()), is(nullValue()));
    }

    @Test
    void resolve_latest_release_to_the_highest_version_when_there_are_no_snapshots() {
        assertThat(SemanticVersionOrder.latestRelease(List.of("1.0.0", "2.0.0", "1.5.0")), is("2.0.0"));
    }

    @Test
    void resolve_latest_release_to_the_highest_release_even_when_a_snapshot_ranks_higher() {
        // The whole reason this method exists: an in-progress 1.1.0-SNAPSHOT must not shadow
        // the published 1.0.0 release for a READ consumer resolving "latest".
        assertThat(SemanticVersionOrder.latestRelease(List.of("1.0.0", "1.1.0-SNAPSHOT")), is("1.0.0"));
    }

    @Test
    void resolve_latest_release_to_the_highest_snapshot_when_nothing_is_published_yet() {
        assertThat(SemanticVersionOrder.latestRelease(List.of("1.0.0-SNAPSHOT")), is("1.0.0-SNAPSHOT"));
        assertThat(SemanticVersionOrder.latestRelease(List.of("1.1.0-SNAPSHOT", "1.0.0-SNAPSHOT")), is("1.1.0-SNAPSHOT"));
    }

    @Test
    void not_mutate_the_input_list_when_resolving_latest_release() {
        List<String> versions = new ArrayList<>(List.of("2.0.0", "1.0.0"));
        SemanticVersionOrder.latestRelease(versions);
        assertThat(versions, contains("2.0.0", "1.0.0"));
    }
}
