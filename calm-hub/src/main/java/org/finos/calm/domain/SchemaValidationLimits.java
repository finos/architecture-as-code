package org.finos.calm.domain;

/**
 * Limits on a schema check of caller input, which the caller controls the size of.
 */
public final class SchemaValidationLimits {
    /** Hub returns at most this many errors and says how many more there are. */
    public static final int MAX_ERRORS = 20;

    /**
     * Hub refuses a decorator write, on REST or MCP, that is larger than this many bytes of UTF-8 JSON. Vert.x makes the
     * full error list before Hub keeps {@link #MAX_ERRORS}, so the size of the decorator bounds the cost of its check.
     */
    public static final int MAX_DECORATOR_JSON_BYTES = 1024 * 1024;

    /** Hub refuses a config write larger than this many bytes of UTF-8 JSON, for the same reason. */
    public static final int MAX_CONFIG_JSON_BYTES = 1024 * 1024;

    private SchemaValidationLimits() {
    }
}
