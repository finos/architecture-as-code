package org.finos.calm.domain.adr;

import java.util.Locale;
import java.util.regex.Pattern;

import static org.finos.calm.resources.ResourceValidationConstants.CUSTOM_ID_REGEX;

/**
 * Derives the human-readable slug an ADR is addressed by in the name-based API.
 *
 * <p>The slug comes from revision 1's title and never changes. {@link #derive} returns
 * {@code null} when the title gives nothing usable; the caller then uses
 * {@link #fallback}. Collisions are the caller's job too: {@link #withSuffix} spells the
 * {@code -2}, {@code -3}, ... candidates.</p>
 */
public final class AdrSlugs {

    public static final int MAX_LENGTH = 64;

    private static final Pattern VALID_SLUG = Pattern.compile(CUSTOM_ID_REGEX);

    private AdrSlugs() {
    }

    public static String derive(String title) {
        if (title == null) {
            return null;
        }
        String slug = title.toLowerCase(Locale.ROOT);
        slug = slug.replaceAll("[^\\x00-\\x7F]", "");
        slug = slug.replaceAll("[^a-z0-9]", "-");
        slug = trimHyphens(slug);
        slug = slug.replaceAll("-{2,}", "-");
        slug = slug.replaceFirst("^[0-9-]+", "");
        slug = trimHyphens(slug);
        slug = truncate(slug);
        return isValid(slug) ? slug : null;
    }

    /** {@link #derive}, or {@link #fallback} when the title gives no slug. */
    public static String deriveOrFallback(String title, int adrId) {
        String derived = derive(title);
        return derived != null ? derived : fallback(adrId);
    }

    public static String fallback(int adrId) {
        return "adr-" + adrId;
    }

    /** The {@code attempt}-th candidate for {@code base}: the base itself, then {@code base-2}, ... */
    public static String withSuffix(String base, int attempt) {
        if (attempt <= 1) return base;
        String suffix = "-" + attempt;
        int maxBase = MAX_LENGTH - suffix.length();
        String trimmed = base.length() > maxBase ? base.substring(0, maxBase) : base;
        trimmed = trimmed.replaceAll("-+$", "");
        return trimmed + suffix;
    }

    public static boolean isValid(String slug) {
        return slug != null && VALID_SLUG.matcher(slug).matches();
    }

    private static String trimHyphens(String value) {
        return value.replaceAll("^-+|-+$", "");
    }

    // Cuts at the last hyphen inside the limit, so no word is split. A single word longer
    // than the limit has no such hyphen and is cut hard.
    private static String truncate(String slug) {
        if (slug.length() <= MAX_LENGTH) {
            return slug;
        }
        if (slug.charAt(MAX_LENGTH) == '-') {
            return slug.substring(0, MAX_LENGTH);
        }
        int lastHyphen = slug.lastIndexOf('-', MAX_LENGTH - 1);
        return lastHyphen > 0 ? slug.substring(0, lastHyphen) : slug.substring(0, MAX_LENGTH);
    }
}
