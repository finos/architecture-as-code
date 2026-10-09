package org.finos.calm.store.noop;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import org.finos.calm.domain.exception.GitHubWriteNotSupportedException;
import org.finos.calm.domain.implementations.PatternImplementations;
import org.finos.calm.store.PageRequest;
import org.finos.calm.store.PatternImplementationStore;

import java.util.Optional;
import java.util.Set;

/**
 * Throws rather than returning an empty list, which would read as "nothing implements this
 * pattern". See ADR 0008 for why GitHub mode has no implementation. This is a read, but it reuses
 * the write exception because that is the one {@code UnsupportedOperationExceptionMapper} maps to 501.
 */
@ApplicationScoped
@Typed(NoOpPatternImplementationStore.class)
public class NoOpPatternImplementationStore implements PatternImplementationStore {

    private static final String MESSAGE = "Pattern implementations are not available in GitHub storage mode.";

    @Override
    public PatternImplementations findImplementations(String namespace, String patternName, String version,
                                                      Optional<Set<String>> readableNamespaces, PageRequest page) {
        throw new GitHubWriteNotSupportedException(MESSAGE);
    }
}
