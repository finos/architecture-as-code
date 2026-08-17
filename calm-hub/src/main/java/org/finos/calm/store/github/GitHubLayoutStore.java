package org.finos.calm.store.github;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.LayoutStore;

import java.util.List;
import java.util.Optional;

/**
 * Layout persistence is not supported in GitHub mode — layouts are client-side state
 * managed via the browser's localStorage. All methods return empty/no-op responses.
 */
@ApplicationScoped
@Typed(GitHubLayoutStore.class)
public class GitHubLayoutStore implements LayoutStore {

    @Override
    public Optional<String> getLayout(String namespace, int architectureId) throws NamespaceNotFoundException {
        return Optional.empty();
    }

    @Override
    public void upsertLayout(String namespace, int architectureId, String layoutJson) throws NamespaceNotFoundException {
        // no-op — layouts not persisted in GitHub mode
    }

    @Override
    public List<Integer> getArchitectureIdsWithLayoutForNamespace(String namespace) throws NamespaceNotFoundException {
        return List.of();
    }
}
