package org.finos.calm.store.util;

import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class TestVersionKeySelectorShould {

    @Test
    void return_the_highest_semver_from_multiple_valid_keys() {
        assertEquals("2-0-0", VersionKeySelector.latestVersionKey(Set.of("1-0-0", "2-0-0", "1-5-0")));
    }

    @Test
    void return_the_single_key_when_set_has_one_entry() {
        assertEquals("3-2-1", VersionKeySelector.latestVersionKey(Set.of("3-2-1")));
    }

    @Test
    void return_valid_key_when_set_contains_malformed_non_three_part_key() {
        // "abc" has fewer than 3 parts → score 0; "1-0-0" wins
        assertEquals("1-0-0", VersionKeySelector.latestVersionKey(Set.of("1-0-0", "abc")));
    }

    @Test
    void return_valid_key_when_set_contains_non_numeric_three_part_key() {
        // "a-b-c" triggers NumberFormatException → score 0; "1-0-0" wins
        assertEquals("1-0-0", VersionKeySelector.latestVersionKey(Set.of("1-0-0", "a-b-c")));
    }

    @Test
    void return_null_for_empty_set() {
        assertNull(VersionKeySelector.latestVersionKey(Set.of()));
    }

    @Test
    void return_zero_version_count_for_null_keys() {
        assertEquals(0, VersionKeySelector.versionCount(null));
    }

    @Test
    void return_zero_version_count_for_empty_set() {
        assertEquals(0, VersionKeySelector.versionCount(Set.of()));
    }

    @Test
    void return_size_version_count_for_populated_set() {
        assertEquals(3, VersionKeySelector.versionCount(Set.of("1-0-0", "1-1-0", "2-0-0")));
    }
}
