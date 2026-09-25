package org.finos.calm.store.util;

import java.util.ArrayList;
import java.util.List;

/**
 * Folds every accepted spelling of a version onto one canonical
 * dot-separated form, so that one logical version is always one stored
 * document.
 *
 * <h2>Why this is needed now and wasn't before</h2>
 * {@code VERSION_REGEX} (see {@code ResourceValidationConstants}) makes both
 * separators optional: {@code ^(0|[1-9][0-9]*)[-.]?(0|[1-9][0-9]*)[-.]?(0|[1-9][0-9]*)$}.
 * Six different request paths therefore denote version 1.0.0 — {@code 1.0.0},
 * {@code 1-0-0}, {@code 1.0-0}, {@code 1-0.0}, {@code 1.00} and {@code 100}
 * — and the API accepts all of them.
 *
 * <p>Under the old shape the version was a <em>map key</em> written via
 * {@code Architecture.getMongoVersion()}, i.e. {@code replace('.', '-')}.
 * That folded the four dotted/dashed spellings together but left
 * {@code 100} and {@code 1.00} as keys of their own, so the old shape
 * already stored one logical version under three different keys.</p>
 *
 * <p>Under {@link org.finos.calm.store.util.MongoVersionDocumentStore}'s shape the version is a
 * <em>field value</em> on its own document. Writing it verbatim would make
 * each spelling a separate document — six documents for one version, each
 * invisible to a read using any of the other five. {@link SemanticVersionOrder}
 * already ranks the spellings equally, but ordering them consistently cannot
 * merge them; only canonicalising on the way in can.</p>
 *
 * <h2>Where it is applied</h2>
 * At the version-store helpers' entry points, so every caller inherits it
 * and reads and writes cannot disagree about the spelling. Canonicalising in
 * the callers instead would mean seven resource types each having to
 * remember to do it.
 *
 * <h2>Why this isn't a regex</h2>
 * A single {@code Pattern} equivalent to {@code VERSION_REGEX} is exactly
 * what CodeQL's {@code java/polynomial-redos} query flags on uncontrolled
 * input: the three digit groups, each optionally un-separated from its
 * neighbours, give the backtracking engine multiple ways to partition a long
 * digit run between them. {@link #of} instead walks the string once, trying
 * each group's length longest-first and preferring a separator when one is
 * present — the same resolution order {@code Pattern}'s backtracking search
 * would settle on for this exact grammar, just written out directly instead
 * of left to the regex engine. That makes it a plain bounded search over at
 * most three groups, not a construct the redos query's regex-AST analysis
 * applies to at all, and it stays linear in the input length rather than
 * polynomial.
 */
public final class CanonicalVersion {

    private static final int GROUP_COUNT = 3;

    // No real version is anywhere near this long. The search below is bounded and linear
    // per level rather than regex-driven, but it's still a plain O(n^2) walk across the
    // grammar's three groups - failing fast on a pathologically long input keeps that a
    // non-issue regardless, rather than relying solely on the algorithm's own shape.
    private static final int MAX_VERSION_LENGTH = 50;

    private CanonicalVersion() {
    }

    /**
     * @param version any accepted spelling, or {@code null}
     * @return the {@code major.minor.patch} form. Input that doesn't match
     * the version grammar (including {@code null} or a string longer than
     * {@link #MAX_VERSION_LENGTH}) is returned unchanged: validation belongs
     * to the resource layer, and a store that quietly rewrote unrecognised
     * input would turn a rejectable request into a document stored under a
     * version nobody asked for.
     */
    public static String of(String version) {
        if (version == null || version.length() > MAX_VERSION_LENGTH) {
            return version;
        }
        List<String> groups = split(version, 0, GROUP_COUNT);
        if (groups == null) {
            return version;
        }
        return String.join(".", groups);
    }

    /**
     * Finds the first (leftmost-longest) way to read exactly {@code groupsRemaining}
     * groups from {@code s} starting at {@code pos}, consuming the string exactly to
     * its end. Mirrors {@code Pattern}'s own backtracking order for
     * {@code (0|[1-9][0-9]*)([-.]?(0|[1-9][0-9]*))*}: try the longest possible group
     * first, and for a given group length prefer a separator to be present over
     * absent, backtracking to shorter groups (and then to no separator) only when a
     * later group can't otherwise be found.
     */
    private static List<String> split(String s, int pos, int groupsRemaining) {
        if (groupsRemaining == 0) {
            return pos == s.length() ? new ArrayList<>() : null;
        }
        if (pos >= s.length()) {
            return null;
        }
        char first = s.charAt(pos);
        if (first < '0' || first > '9') {
            return null;
        }

        int maxEnd;
        if (first == '0') {
            // "0" is the only valid group starting with '0' - a leading zero followed
            // by more digits matches neither alternative in the grammar.
            maxEnd = pos + 1;
        } else {
            int end = pos + 1;
            while (end < s.length() && Character.isDigit(s.charAt(end))) {
                end++;
            }
            maxEnd = end;
        }

        if (groupsRemaining == 1) {
            // The last group must consume everything remaining - it's a single candidate
            // (the whole digit run), not a range to search.
            return maxEnd == s.length() ? List.of(s.substring(pos)) : null;
        }

        for (int end = maxEnd; end > pos; end--) {
            String group = s.substring(pos, end);
            if (end < s.length() && isSeparator(s.charAt(end))) {
                List<String> rest = split(s, end + 1, groupsRemaining - 1);
                if (rest != null) {
                    return prepend(group, rest);
                }
            }
            List<String> rest = split(s, end, groupsRemaining - 1);
            if (rest != null) {
                return prepend(group, rest);
            }
            if (first == '0') {
                break; // only one possible length ("0") was ever available here
            }
        }
        return null;
    }

    private static List<String> prepend(String group, List<String> rest) {
        List<String> result = new ArrayList<>(rest.size() + 1);
        result.add(group);
        result.addAll(rest);
        return result;
    }

    private static boolean isSeparator(char c) {
        return c == '-' || c == '.';
    }
}
