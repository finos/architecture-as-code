package org.finos.calm.domain;

import org.finos.calm.domain.exception.InvalidResourceIdException;

/** Unwraps a {@link ResourceId} to the shape a store backend needs. */
public final class ResourceIds {

    private static final String NUMERIC_REQUIRED = "This storage backend requires a numeric resource id";

    private ResourceIds() {
    }

    public static int numeric(ResourceId id) {
        if (id instanceof NumericResourceId numeric) {
            return numeric.value();
        }
        throw new InvalidResourceIdException(NUMERIC_REQUIRED);
    }

    /** Parses a positive int from the string form of a numeric-mode id. */
    public static int parseNumeric(String id) {
        if (id != null) {
            try {
                int value = Integer.parseInt(id);
                if (value > 0) {
                    return value;
                }
            } catch (NumberFormatException ignored) {
                // Fall through to the shared error below.
            }
        }
        throw new InvalidResourceIdException(NUMERIC_REQUIRED);
    }

    public static GitHubResourceId github(ResourceId id) {
        if (id instanceof GitHubResourceId github) {
            return github;
        }
        throw new InvalidResourceIdException("This storage backend requires a GitHub resource id");
    }
}
