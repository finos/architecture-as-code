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

    /** Parses the string form of a numeric-mode id. Non-numeric (GitHub) ids are not accepted. */
    public static int parseNumeric(String id) {
        if (id != null && id.matches("\\d{1,9}")) {
            return Integer.parseInt(id);
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
