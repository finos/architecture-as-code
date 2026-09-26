package org.finos.calm.store.github.registry;

import org.finos.calm.domain.ResourceType;

/**
 * What kind of CALM file the GitHub-mode registry found while scanning a cloned repo —
 * deliberately not {@link ResourceType}, which answers a different question:
 * "which plural URL segment can the namespace front controller address?"
 *
 * <p>The two overlap on the seven types both track, but neither one degrades to the other.
 * {@code ResourceType} is serialized on {@code ResourceMapping} (a public API shape) and is
 * name-coupled to {@code AuditEntityType} via {@code AuditEntityType.valueOf(...)}
 * ({@code AuditRequestFilter}) — widening it to cover {@code ADR}, {@code TIMELINE} and
 * {@code DECORATOR} would be a public schema change with a matching-name obligation on a
 * second enum, not an internal refactor. This type carries no such constraint: it only
 * ever crosses the boundary between the registry scanner and the GitHub stores that read
 * from it, so it stays free to describe every file shape those stores classify.
 *
 * <p>There is no {@code UNKNOWN} constant. A file the scanner can't classify is not a
 * ninth kind of resource — it's the absence of one, which {@link CalmContentDetector#detect}
 * expresses as {@code Optional.empty()} rather than by adding a sentinel here.</p>
 */
public enum RegistryResourceType {
    ARCHITECTURE,
    PATTERN,
    STANDARD,
    CONTROL,
    ADR,
    FLOW,
    INTERFACE,
    TIMELINE,
    DECORATOR
}
