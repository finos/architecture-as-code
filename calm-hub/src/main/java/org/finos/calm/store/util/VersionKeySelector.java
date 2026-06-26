package org.finos.calm.store.util;

import java.util.Comparator;
import java.util.Set;

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
