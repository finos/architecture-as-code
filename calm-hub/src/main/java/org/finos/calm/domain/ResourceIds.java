package org.finos.calm.domain;

import org.finos.calm.domain.exception.InvalidResourceIdException;

/** Unwraps a {@link ResourceId} to the shape a store backend needs. */
public final class ResourceIds {

    private ResourceIds() {
    }

    public static int numeric(ResourceId id) {
        if (id instanceof NumericResourceId numeric) {
            return numeric.value();
        }
        throw new InvalidResourceIdException("This storage backend requires a numeric resource id");
    }

    /**
     * Parses the string form of a numeric-mode id. Non-numeric (GitHub) ids are not accepted.
     * The 1–9 digit bound matches the counter range used by the numeric stores; ids beyond it
     * are rejected rather than silently accepted as a wrong resource.
     */
    public static int parseNumeric(String id) {
        if (id != null && id.matches("\\d{1,9}")) {
            try {
                return Integer.parseInt(id);
            } catch (NumberFormatException e) {
                // Unreachable for 1-9 digits, but fail closed rather than propagate a runtime parse error.
                throw new InvalidResourceIdException("This storage backend requires a numeric resource id");
            }
        }
        throw new InvalidResourceIdException("This storage backend requires a numeric resource id");
    }

    public static GitHubResourceId github(ResourceId id) {
        if (id instanceof GitHubResourceId github) {
            return github;
        }
        throw new InvalidResourceIdException("This storage backend requires a GitHub resource id");
    }
}
