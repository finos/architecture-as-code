package org.finos.calm.services;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.finos.calm.domain.CustomIdentifiable;
import org.finos.calm.domain.ResourceMapping;
import org.finos.calm.domain.ResourceType;
import org.finos.calm.store.ResourceMappingStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

import static org.finos.calm.resources.ResourceValidationConstants.STRICT_SANITIZATION_POLICY;

/**
 * Resolves the human-readable {@code customId} held in {@code resource_mappings} for a page of
 * namespace listing summaries, so a caller can link a resource by custom ID without a second
 * round trip per item.
 *
 * <p>A custom ID exists only for resources written through the name-based ({@code /calm}) API, so a
 * listing is normally a mix of mapped and unmapped resources. Enrichment is therefore a display
 * affordance, not a correctness requirement — see {@link #enrich}.</p>
 */
@ApplicationScoped
public class CustomIdEnrichmentService {

    private static final Logger logger = LoggerFactory.getLogger(CustomIdEnrichmentService.class);

    private final ResourceMappingStore mappingStore;

    @Inject
    public CustomIdEnrichmentService(ResourceMappingStore mappingStore) {
        this.mappingStore = mappingStore;
    }

    /**
     * Writes the resolved custom ID onto each summary that has a mapping, via one batched lookup
     * against the {@code (namespace, resourceType, numericId)} index rather than a query per
     * summary. Mutates and returns the list it was given.
     *
     * <p>A failure resolving the mappings is logged and swallowed: the numeric IDs are already
     * complete, so losing a custom ID degrades a link to its numeric form rather than breaking the
     * listing.</p>
     */
    public <T extends CustomIdentifiable> List<T> enrich(String namespace, ResourceType type, List<T> summaries) {
        if (summaries == null || summaries.isEmpty()) {
            return summaries;
        }

        List<Integer> numericIds = summaries.stream()
                .map(CustomIdentifiable::getId)
                .filter(Objects::nonNull)
                .toList();

        if (numericIds.isEmpty()) {
            return summaries;
        }

        try {
            // Only (namespace, resourceType, customId) is unique, so two custom IDs may point at the
            // same numeric ID — collapse on collision rather than letting toMap throw. A mapping
            // document with no customId at all is dropped for the same reason: toMap rejects a null
            // value, and one malformed row must not cost the whole page its custom IDs.
            Map<Integer, String> customIdsByNumericId = mappingStore
                    .listMappingsByNumericIds(namespace, type, numericIds)
                    .stream()
                    .filter(mapping -> mapping.getCustomId() != null)
                    .collect(Collectors.toMap(
                            ResourceMapping::getNumericId,
                            ResourceMapping::getCustomId,
                            (first, second) -> first));

            for (T summary : summaries) {
                String customId = customIdsByNumericId.get(summary.getId());
                if (customId != null) {
                    summary.setCustomId(customId);
                }
            }
        } catch (Exception e) {
            logger.warn("Could not resolve custom IDs for [{}] in namespace [{}]; returning numeric IDs only",
                    type, STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
        }

        return summaries;
    }
}
