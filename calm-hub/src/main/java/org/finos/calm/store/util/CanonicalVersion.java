package org.finos.calm.store.util;

import org.finos.calm.resources.ResourceValidationConstants;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

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
 * <h2>Coupling note</h2>
 * This deliberately reuses {@code ResourceValidationConstants.VERSION_REGEX}
 * rather than restating the pattern, even though it points from the store
 * layer at the resource layer. The set of spellings this must fold is
 * exactly the set the API accepts, so a second copy of the pattern would be
 * a correctness bug waiting for the two to drift apart.
 */
public final class CanonicalVersion {

    private static final Pattern VERSION = Pattern.compile(ResourceValidationConstants.VERSION_REGEX);

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
        Matcher matcher = VERSION.matcher(version);
        if (!matcher.matches()) {
            return version;
        }
        return matcher.group(1) + "." + matcher.group(2) + "." + matcher.group(3);
    }
}
