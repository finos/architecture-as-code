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
import org.finos.calm.store.PageRequest;
import org.finos.calm.store.PatternImplementationStore;
import org.finos.calm.store.PatternStore;
import org.finos.calm.store.ResourceMappingStore;
import org.finos.calm.store.util.CanonicalVersion;

import static org.finos.calm.resources.ResourceValidationConstants.STRICT_SANITIZATION_POLICY;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
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
 * when it was generated from a pattern fetched from this hub. The count of architectures naming no
 * resolvable pattern travels with the result so that an empty answer can be told apart from a
 * corpus that was never linkable.</p>
 */
@ApplicationScoped
public class PatternImplementationService {

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
     * @return the implementations, or empty when the pattern does not exist or the caller may not
     *         read its namespace — the two are deliberately indistinguishable, so that a 404 does
     *         not tell the caller a pattern exists where they have no access.
     */
    public Optional<PatternImplementations> findImplementations(String namespace, String patternName, String version,
                                                                Optional<Set<String>> readableNamespaces,
                                                                PageRequest page) {
        if (readableNamespaces.isPresent() && !readableNamespaces.get().contains(namespace)) {
            return Optional.empty();
        }
        String canonicalVersion = CanonicalVersion.of(version);
        if (!patternVersionExists(namespace, patternName, canonicalVersion)) {
            return Optional.empty();
        }
        return Optional.of(withCustomIds(implementationStore.findImplementations(
                namespace, patternName, canonicalVersion, readableNamespaces, page)));
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
    private PatternImplementations withCustomIds(PatternImplementations found) {
        Map<String, List<PatternImplementation>> byNamespace = found.getImplementations().stream()
                .collect(Collectors.groupingBy(PatternImplementation::getNamespace));

        List<PatternImplementation> enriched = new ArrayList<>(found.getImplementations().size());
        for (Map.Entry<String, List<PatternImplementation>> entry : byNamespace.entrySet()) {
            Map<Integer, String> names = customIdsFor(entry.getKey(), entry.getValue());
            for (PatternImplementation implementation : entry.getValue()) {
                enriched.add(implementation.withCustomId(names.get(implementation.getArchitectureId())));
            }
        }
        return new PatternImplementations(found.getPattern(), enriched);
    }

    private Map<Integer, String> customIdsFor(String namespace, List<PatternImplementation> implementations) {
        List<Integer> ids = implementations.stream().map(PatternImplementation::getArchitectureId).toList();
        try {
            Map<Integer, String> names = new HashMap<>();
            for (ResourceMapping mapping :
                    mappingStore.listMappingsByNumericIds(namespace, ResourceType.ARCHITECTURE, ids)) {
                names.put(mapping.getNumericId(), mapping.getCustomId());
            }
            return names;
        } catch (NamespaceNotFoundException e) {
            // The namespace came from a stored document, so this means it was removed mid-request.
            // A missing display name is not worth failing an otherwise complete answer.
            logger.warn("Could not resolve architecture names in namespace [{}]",
                    STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return Map.of();
        }
    }
}
