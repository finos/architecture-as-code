package org.finos.calm.store.github;

import org.finos.calm.domain.exception.GitHubWriteNotSupportedException;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.finos.calm.domain.Decorator;
import org.finos.calm.domain.exception.DecoratorNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.DecoratorStore;
import org.finos.calm.store.github.registry.ResourceRegistry;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

/**
 * GitHub-mode {@link DecoratorStore}: like {@link GitHubAdrStore}, decorators have no
 * registry representation - no file convention exists to classify a decorator from a repo
 * checkout - so every lookup returns an empty result rather than guessing, and every write
 * is an unconditional {@link GitHubWriteNotSupportedException}. Extends only
 * {@link AbstractGitHubStore}: with nothing to read, the shared read-path machinery in
 * {@link AbstractReadOnlyGitHubStore} would be dead code here.
 */
@ApplicationScoped
@Typed(GitHubDecoratorStore.class)
public class GitHubDecoratorStore extends AbstractGitHubStore implements DecoratorStore {

    @Inject
    public GitHubDecoratorStore(ResourceRegistry registryService) {
        super(registryService);
    }

    @Override
    public List<Integer> getDecoratorsForNamespace(String namespace, String target, String type) throws NamespaceNotFoundException {
        verifyNamespace(namespace);
        return Collections.emptyList();
    }

    @Override
    public List<Decorator> getDecoratorValuesForNamespace(String namespace, String target, String type) throws NamespaceNotFoundException {
        verifyNamespace(namespace);
        return Collections.emptyList();
    }

    @Override
    public Optional<Decorator> getDecoratorById(String namespace, int id) throws NamespaceNotFoundException {
        verifyNamespace(namespace);
        return Optional.empty();
    }

    @Override
    public int createDecorator(String namespace, String decoratorJson) throws NamespaceNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public void updateDecorator(String namespace, int id, String decoratorJson) throws NamespaceNotFoundException, DecoratorNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public void deleteDecorator(String namespace, int id) throws NamespaceNotFoundException, DecoratorNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }
}
