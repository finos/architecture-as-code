package org.finos.calm.services;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.finos.calm.domain.Pattern;
import org.finos.calm.domain.ResourceMapping;
import org.finos.calm.domain.ResourceType;
import org.finos.calm.domain.exception.MappingNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.PatternNotFoundException;
import org.finos.calm.domain.implementations.PatternImplementation;
import org.finos.calm.domain.implementations.PatternImplementations;
import org.finos.calm.domain.implementations.PatternReference;
import org.finos.calm.store.ArchitectureSchema;
import org.finos.calm.store.PageRequest;
import org.finos.calm.store.PatternImplementationStore;
import org.finos.calm.store.PatternStore;
import org.finos.calm.store.ResourceMappingStore;
import org.finos.calm.store.util.CanonicalVersion;
import org.finos.calm.store.util.PatternReferenceMatcher;
import org.finos.calm.store.util.SemanticVersionOrder;

import static org.finos.calm.resources.ResourceValidationConstants.STRICT_SANITIZATION_POLICY;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Answers "which architectures implement this pattern version?".
 *
 * <p>The linkage is the architecture's own {@code $schema}, which {@code calm generate} sets to the
 * pattern's {@code $id}. Nothing validates that field on write, so an architecture is findable only
 * when it was generated from a pattern fetched from this hub.</p>
 *
 * <p>The store only narrows the candidates. The version match, the order and the paging all run
 * here, once, so that the backends cannot disagree.</p>
 */
@ApplicationScoped
public class PatternImplementationService {

    private static final Comparator<PatternImplementation> ORDER =
            Comparator.comparing(PatternImplementation::getNamespace)
                    .thenComparingInt(PatternImplementation::getArchitectureId)
                    .thenComparing(PatternImplementation::getVersion, SemanticVersionOrder.ASCENDING);

    private final Logger logger = LoggerFactory.getLogger(PatternImplementationService.class);

    private final PatternImplementationStore implementationStore;
    private final ResourceMappingStore mappingStore;
    private final PatternStore patternStore;

    @Inject
    public PatternImplementationService(PatternImplementationStore implementationStore,
                                        ResourceMappingStore mappingStore,
                                        PatternStore patternStore) {
        this.implementationStore = implementationStore;
        this.mappingStore = mappingStore;
        this.patternStore = patternStore;
    }

    /**
     * @param readableNamespaces namespaces the caller may read, or empty for unrestricted access.
     * @param page               an optional window over the results. {@link PageRequest#UNPAGED}
     *                           returns every match. A fixed cap is deliberately not applied: this
     *                           answers a blast-radius question, and silently returning the first
     *                           few would report a change as safe when it is not.
     * @return the implementations, or empty when the pattern version does not exist.
     */
    public Optional<PatternImplementations> findImplementations(String namespace, String patternName, String version,
                                                                Optional<Set<String>> readableNamespaces,
                                                                PageRequest page) {
        String canonicalVersion = CanonicalVersion.of(version);
        // Asked before the version check, so that GitHub mode, whose store refuses, answers 501.
        // Its pattern versions are commit SHAs, so the version check would answer 404 instead.
        java.util.regex.Pattern path = PatternReferenceMatcher.pathPattern(namespace, patternName);
        List<ArchitectureSchema> candidates = implementationStore.findSchemasContaining(path, readableNamespaces);
        if (!patternVersionExists(namespace, patternName, canonicalVersion)) {
            return Optional.empty();
        }

        List<PatternImplementation> implementations = candidates.stream()
                .filter(candidate -> PatternReferenceMatcher.references(candidate.schema(), path, canonicalVersion))
                .map(candidate -> new PatternImplementation(
                        candidate.namespace(), candidate.architectureId(), candidate.version(), null))
                .sorted(ORDER)
                .toList();
        return Optional.of(new PatternImplementations(
                new PatternReference(namespace, patternName, canonicalVersion),
                withCustomIds(page.apply(implementations))));
    }

    /**
     * True when the hub holds this pattern version. Checking the version as well as the name stops
     * a request for a version that never existed returning an empty list, which reads the same as a
     * version nothing implements. {@code getPatternVersions} returns version strings rather than
     * the pattern body, so the check costs one indexed read.
     */
    private boolean patternVersionExists(String namespace, String patternName, String canonicalVersion) {
        try {
            ResourceMapping mapping = mappingStore.getMapping(namespace, ResourceType.PATTERN, patternName);
            Pattern pattern = new Pattern.PatternBuilder()
                    .setNamespace(namespace)
                    .setId(mapping.getNumericId())
                    .build();
            return patternStore.getPatternVersions(pattern).stream()
                    .map(CanonicalVersion::of)
                    .anyMatch(canonicalVersion::equals);
        } catch (MappingNotFoundException | NamespaceNotFoundException | PatternNotFoundException e) {
            logger.info("Pattern [{}] not found in namespace [{}]",
                    STRICT_SANITIZATION_POLICY.sanitize(patternName), STRICT_SANITIZATION_POLICY.sanitize(namespace));
            return false;
        }
    }

    /**
     * Fills in the name each architecture is addressed by on the name-based API. Resolved in one
     * bulk lookup per namespace rather than one per result — results routinely share a namespace,
     * and the per-result shape is the N+1 that ADR 0006 removed elsewhere. An architecture written
     * through the numeric API never had a name and keeps a null.
     */
    private List<PatternImplementation> withCustomIds(List<PatternImplementation> implementations) {
        Map<String, List<PatternImplementation>> byNamespace = implementations.stream()
                .collect(Collectors.groupingBy(PatternImplementation::getNamespace));

        Map<String, Map<Integer, String>> namesByNamespace = new HashMap<>();
        byNamespace.forEach((namespace, rows) -> namesByNamespace.put(namespace, customIdsFor(namespace, rows)));

        // Rebuilt over the sorted list rather than over the grouping, which is in hash order.
        return implementations.stream()
                .map(implementation -> implementation.withCustomId(
                        namesByNamespace.get(implementation.getNamespace()).get(implementation.getArchitectureId())))
                .toList();
    }

    /**
     * A namespace that has gone since the match ran has no names to give. Any other failure fails
     * the request: an omitted name means the architecture never had one, so a swallowed error
     * would report every row as unnamed.
     */
    private Map<Integer, String> customIdsFor(String namespace, List<PatternImplementation> implementations) {
        List<Integer> ids = implementations.stream()
                .map(PatternImplementation::getArchitectureId)
                .distinct()
                .toList();
        try {
            Map<Integer, String> names = new HashMap<>();
            for (ResourceMapping mapping :
                    mappingStore.listMappingsByNumericIds(namespace, ResourceType.ARCHITECTURE, ids)) {
                names.put(mapping.getNumericId(), mapping.getCustomId());
            }
            return names;
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace [{}] not found while resolving architecture names",
                    STRICT_SANITIZATION_POLICY.sanitize(namespace));
            return Map.of();
        }
    }
}
