package org.finos.calm.store.util;

/**
 * Shared search matching utilities used by both MongoDB and NitriteDB search store implementations.
 * Provides a consistent, case-insensitive substring matching algorithm across backends.
 */
public final class SearchTextMatcher {

    private SearchTextMatcher() {
    }

    /**
     * Returns true if {@code value} contains {@code lowerQuery} as a case-insensitive substring.
     *
     * @param value      the field value to test (may be null)
     * @param lowerQuery the search query, already lowercased by the caller
     * @return true when value is non-null and contains the query
     */
    public static boolean containsIgnoreCase(String value, String lowerQuery) {
        if (value == null) {
            return false;
        }
        return value.toLowerCase().contains(lowerQuery);
    }

    /**
     * Returns the non-null value, or an empty string if null.
     */
    public static String nullToEmpty(String value) {
        return value != null ? value : "";
    }
}
