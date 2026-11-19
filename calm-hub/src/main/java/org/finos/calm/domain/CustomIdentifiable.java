package org.finos.calm.domain;

/**
 * Implemented by namespace listing summaries so {@code CustomIdEnrichmentService} can resolve
 * the custom ID for any of them through one code path — the listing endpoints return two unrelated
 * summary types with no common supertype of their own.
 */
public interface CustomIdentifiable {

    /**
     * The string form of the resource id: the numeric id in MongoDB and standalone modes,
     * the filename stem in GitHub mode. Read-only; minted when the summary is built.
     */
    String getId();

    String getCustomId();

    void setCustomId(String customId);
}
