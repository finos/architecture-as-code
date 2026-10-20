package org.finos.calm.store;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

public interface PatternImplementationStore {

    /**
     * Finds the architecture versions whose {@code $schema} contains a match for {@code path}.
     *
     * <p>The result is a superset. The caller decides which rows name the pattern version it
     * asked about, and sorts and pages them, so that every backend gives the same answer.</p>
     *
     * @param path               from {@code PatternReferenceMatcher.pathPattern}
     * @param readableNamespaces namespaces the caller may read, or empty for unrestricted access.
     *                           The search spans every namespace in that set, because an
     *                           architecture in one namespace can implement a pattern in another.
     */
    List<ArchitectureSchema> findSchemasContaining(Pattern path, Optional<Set<String>> readableNamespaces);
}
