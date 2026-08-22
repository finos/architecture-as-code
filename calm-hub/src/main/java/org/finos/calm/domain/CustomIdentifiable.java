package org.finos.calm.domain;

/**
 * Implemented by namespace listing summaries so {@code CustomIdEnrichmentService} can resolve
 * the custom ID for any of them through one code path — the listing endpoints return two unrelated
 * summary types with no common supertype of their own.
 */
public interface CustomIdentifiable {

    /** Read-only: the numeric ID is minted by the counter store when the summary is built. */
    Integer getId();

    String getCustomId();

    void setCustomId(String customId);
}
