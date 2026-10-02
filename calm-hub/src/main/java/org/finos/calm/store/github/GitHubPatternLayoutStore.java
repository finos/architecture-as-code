package org.finos.calm.store.github;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.PatternNotFoundException;
import org.finos.calm.store.PatternLayoutStore;

import java.util.List;
import java.util.Optional;

/**
 * Layout persistence is not supported in GitHub mode - layouts are client-side state
 * managed via the browser's localStorage. All methods return empty/no-op responses,
 * mirroring {@link GitHubLayoutStore}'s equivalent for architectures.
 *
 * <p>Without this class, {@code PatternLayoutStoreProducer} had no GitHub branch at all -
 * it fell through to {@code MongoPatternLayoutStore}, which is itself
 * {@code @LookupIfProperty(stringValue = "mongo")}-gated and so doesn't exist as a bean in
 * GitHub mode: every pattern-layout request resolved to an unsatisfied injection and
 * failed with a 500, not a clean empty/no-op response.
 */
@ApplicationScoped
@Typed(GitHubPatternLayoutStore.class)
public class GitHubPatternLayoutStore implements PatternLayoutStore {

    @Override
    public Optional<String> getLayout(String namespace, int patternId) throws NamespaceNotFoundException {
        return Optional.empty();
    }

    @Override
    public void upsertLayout(String namespace, int patternId, String layoutJson)
            throws NamespaceNotFoundException, PatternNotFoundException {
        // no-op — layouts not persisted in GitHub mode
    }

    @Override
    public List<Integer> getPatternIdsWithLayoutForNamespace(String namespace) throws NamespaceNotFoundException {
        return List.of();
    }
}
