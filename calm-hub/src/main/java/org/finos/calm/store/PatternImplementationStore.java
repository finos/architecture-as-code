package org.finos.calm.store;

import org.finos.calm.domain.implementations.PatternImplementations;
import org.finos.calm.store.PageRequest;

import java.util.Optional;
import java.util.Set;

public interface PatternImplementationStore {

    /**
     * Finds the architecture versions whose {@code $schema} names the given pattern version.
     *
     * <p>An architecture is found only when it says so itself. That happens when someone generated
     * it from a pattern fetched from this hub, because {@code calm generate} copies the pattern's
     * {@code $id} into the architecture's {@code $schema}. An architecture generated from a pattern
     * file on disk carries that file's own id instead. One written by hand, or posted through the
     * numeric API, carries whatever its author supplied. Neither is matched, and neither is
     * reported.</p>
     *
     * @param readableNamespaces namespaces the caller may read, or empty for unrestricted access.
     *                           The search spans every namespace in that set, because an
     *                           architecture in one namespace can implement a pattern in another.
     * @param page               an optional window over the results. {@link PageRequest#UNPAGED} is
     *                           the default, so a caller who asks for no limit receives every match.
     *                           A fixed cap is deliberately not applied: this answers a blast-radius
     *                           question, and silently returning the first few would report a change
     *                           as safe when it is not.
     */
    PatternImplementations findImplementations(String namespace, String patternName, String version,
                                               Optional<Set<String>> readableNamespaces, PageRequest page);
}
