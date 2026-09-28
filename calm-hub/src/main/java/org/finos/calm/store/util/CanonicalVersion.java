package org.finos.calm.store.util;

import java.util.Arrays;

/**
 * Folds every accepted spelling of a version onto one canonical
 * dot-separated form, so that one logical version is always one stored
 * document.
 *
 * <h2>Why this is needed now and wasn't before</h2>
 * {@code VERSION_REGEX} makes both separators optional:
 * {@code ^(0|[1-9][0-9]*)[-.]?(0|[1-9][0-9]*)[-.]?(0|[1-9][0-9]*)$}. Six
 * different request paths therefore denote version 1.0.0 — {@code 1.0.0},
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
 * <h2>Why this does not run the regex</h2>
 * {@code VERSION_REGEX} remains the definition of what the API accepts, and
 * this class must agree with it exactly. It does not <em>execute</em> it,
 * though: with both separators optional, the two {@code [0-9]*} groups compete
 * for the same digit run, so a match backtracks polynomially on input such as
 * {@code 0111…1x} (CodeQL {@code java/polynomial-redos}). The parser below
 * reproduces the regex's leftmost-greedy split in linear time instead.
 * {@code TestCanonicalVersionShould} compares the two exhaustively over every
 * short string, so the copies cannot drift apart unnoticed.
 */
public final class CanonicalVersion {

    private CanonicalVersion() {
    }

    /**
     * @param version any accepted spelling, or {@code null}
     * @return the {@code major.minor.patch} form. Input that doesn't match
     * {@code VERSION_REGEX} (including {@code null}) is returned unchanged:
     * validation belongs to the resource layer, and a store that quietly
     * rewrote unrecognised input would turn a rejectable request into a
     * document stored under a version nobody asked for.
     */
    public static String of(String version) {
        if (version == null) {
            return null;
        }
        String[] segments = split(version);
        if (segments == null) {
            return version;
        }
        return segments[0] + "." + segments[1] + "." + segments[2];
    }

    /**
     * The three segments {@code VERSION_REGEX} would capture, or {@code null}
     * where it would not match. Separators fix segment boundaries wherever
     * they are present; where they are absent the regex's greedy quantifiers
     * give the earlier segment as many digits as still leaves a valid segment
     * for each later one, which is the order the loops below try.
     */
    private static String[] split(String version) {
        String[] runs = digitRuns(version);
        if (runs == null) {
            return null;
        }
        return switch (runs.length) {
            case 3 -> isSegment(runs[0]) && isSegment(runs[1]) && isSegment(runs[2]) ? runs : null;
            case 2 -> splitTwoRuns(runs[0], runs[1]);
            default -> splitOneRun(runs[0]);
        };
    }

    /** Digit runs between separators, or {@code null} for any character or shape the regex rejects. */
    private static String[] digitRuns(String version) {
        String[] runs = new String[3];
        int count = 0;
        int start = 0;
        for (int i = 0; i <= version.length(); i++) {
            boolean atEnd = i == version.length();
            char c = atEnd ? '.' : version.charAt(i);
            if (c == '.' || c == '-') {
                if (i == start || count == 3) {
                    return null;
                }
                runs[count++] = version.substring(start, i);
                start = i + 1;
            } else if (c < '0' || c > '9') {
                return null;
            }
        }
        return count == 3 ? runs : Arrays.copyOf(runs, count);
    }

    private static String[] splitTwoRuns(String first, String last) {
        for (int end = first.length(); end >= 1; end--) {
            if (!isSegment(first, 0, end)) {
                continue;
            }
            if (end == first.length()) {
                String[] tail = splitGreedy(last);
                if (tail != null) {
                    return new String[] {first, tail[0], tail[1]};
                }
            } else if (isSegment(first, end, first.length()) && isSegment(last)) {
                return new String[] {first.substring(0, end), first.substring(end), last};
            }
        }
        return null;
    }

    private static String[] splitOneRun(String run) {
        for (int end = run.length() - 2; end >= 1; end--) {
            if (!isSegment(run, 0, end)) {
                continue;
            }
            String[] tail = splitGreedy(run.substring(end));
            if (tail != null) {
                return new String[] {run.substring(0, end), tail[0], tail[1]};
            }
        }
        return null;
    }

    /** The longest valid leading segment that leaves a valid trailing segment, as the regex's greedy groups find it. */
    private static String[] splitGreedy(String run) {
        for (int end = run.length() - 1; end >= 1; end--) {
            if (isSegment(run, 0, end) && isSegment(run, end, run.length())) {
                return new String[] {run.substring(0, end), run.substring(end)};
            }
        }
        return null;
    }

    private static boolean isSegment(String run) {
        return isSegment(run, 0, run.length());
    }

    /** {@code 0|[1-9][0-9]*} over an all-digit range: non-empty, and no leading zero unless it is the single digit 0. */
    private static boolean isSegment(String run, int from, int to) {
        return to > from && (run.charAt(from) != '0' || to - from == 1);
    }
}
