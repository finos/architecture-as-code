package org.finos.calm.domain;

import org.bson.Document;

/**
 * Extracts the {@code name} and {@code description} fields from CALM JSON content
 * (patterns and control requirements). Used by stores to keep the wrapper-level
 * {@code name}/{@code description} in sync with the latest version's JSON body, so
 * list endpoints reflect the most recently posted content.
 *
 * <p>Both pattern and control-requirement schemas declare {@code name} and
 * {@code description} as required top-level string fields. When the JSON cannot be
 * parsed, or the fields are missing/non-string, the corresponding accessor returns
 * {@code null} and callers should fall back to their existing wrapper values.
 */
public final class CalmJsonMetadata {

    private final String name;
    private final String description;

    private CalmJsonMetadata(String name, String description) {
        this.name = name;
        this.description = description;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    public boolean hasName() {
        return name != null && !name.isBlank();
    }

    public boolean hasDescription() {
        return description != null && !description.isBlank();
    }

    /**
     * Parses {@code json} and returns the top-level {@code name} / {@code description}
     * string fields if present. Returns an empty instance (both {@code null}) if the
     * input is blank, fails to parse, or the fields are absent/non-string.
     */
    public static CalmJsonMetadata extract(String json) {
        if (json == null || json.isBlank()) {
            return new CalmJsonMetadata(null, null);
        }
        try {
            return extract(Document.parse(json));
        } catch (RuntimeException e) {
            return new CalmJsonMetadata(null, null);
        }
    }

    /**
     * Reads the top-level {@code name} / {@code description} string fields from an
     * already-parsed {@link Document}. Returns an empty instance if {@code parsed} is
     * {@code null} or the fields are missing/non-string.
     */
    public static CalmJsonMetadata extract(Document parsed) {
        if (parsed == null) {
            return new CalmJsonMetadata(null, null);
        }
        Object name = parsed.get("name");
        Object description = parsed.get("description");
        return new CalmJsonMetadata(
                name instanceof String s ? s : null,
                description instanceof String s ? s : null);
    }
}
