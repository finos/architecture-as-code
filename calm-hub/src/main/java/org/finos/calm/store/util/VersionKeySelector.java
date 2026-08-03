package org.finos.calm.store.util;

import java.util.Comparator;
import java.util.Set;

/**
 * Picks the latest of a set of dash-encoded version keys.
 *
 * <p>All that remains of this class after the ADR 0001 storage redesign: its
 * {@code versionCount} method lost every caller once the seven versioned types moved to the
 * header/version shape, where the count is a stored field rather than the size of a loaded
 * map, and was deleted. {@link #latestVersionKey} survives because
 * {@code MongoControlStore} and {@code NitriteControlStore} still use it, and Control keeps
 * the old shape and its dash-encoded keys deliberately (ADR 0004).</p>
 *
 * <p>Do not reach for this from a migrated type. It splits on {@code "-"}, so it only
 * understands the old encoding; {@code SemanticVersionOrder} and {@code NumericVersionOrder}
 * are what rank versions in the new shape. This class retires with Control.</p>
 */
public final class VersionKeySelector {

    private VersionKeySelector() {
    }

    public static String latestVersionKey(Set<String> keys) {
        return keys.stream()
                .max(Comparator.comparingInt(k -> {
                    String[] parts = k.split("-");
                    if (parts.length != 3) return 0;
                    try {
                        return Integer.parseInt(parts[0]) * 1_000_000
                                + Integer.parseInt(parts[1]) * 1_000
                                + Integer.parseInt(parts[2]);
                    } catch (NumberFormatException e) {
                        return 0;
                    }
                }))
                .orElse(null);
    }
}
