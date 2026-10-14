package org.finos.calm.store.noop;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import org.finos.calm.domain.exception.GitHubModeNotSupportedException;
import org.finos.calm.store.ArchitectureSchema;
import org.finos.calm.store.PatternImplementationStore;

import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Throws rather than returning an empty list, which would read as "nothing implements this
 * pattern". See ADR 0008 for why GitHub mode has no implementation.
 */
@ApplicationScoped
@Typed(NoOpPatternImplementationStore.class)
public class NoOpPatternImplementationStore implements PatternImplementationStore {

    private static final String MESSAGE = "Pattern implementations are not available in GitHub storage mode.";

    @Override
    public List<ArchitectureSchema> findSchemasContaining(String schemaPath, Optional<Set<String>> readableNamespaces) {
        throw new GitHubModeNotSupportedException(MESSAGE);
    }
}
