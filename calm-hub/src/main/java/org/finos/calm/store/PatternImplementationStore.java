package org.finos.calm.store;

import java.util.List;
import java.util.Optional;
import java.util.Set;

public interface PatternImplementationStore {

    /**
     * Finds the architecture versions whose {@code $schema} contains {@code schemaPath}.
     *
     * <p>The result is a superset. The caller decides which rows name the pattern version it
     * asked about, and sorts and pages them, so that every backend gives the same answer.</p>
     *
     * @param readableNamespaces namespaces the caller may read, or empty for unrestricted access.
     *                           The search spans every namespace in that set, because an
     *                           architecture in one namespace can implement a pattern in another.
     */
    List<ArchitectureSchema> findSchemasContaining(String schemaPath, Optional<Set<String>> readableNamespaces);
}
