package org.finos.calm.store.github;

import org.finos.calm.domain.exception.GitHubWriteNotSupportedException;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.finos.calm.domain.Decorator;
import org.finos.calm.domain.exception.DecoratorNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.DecoratorStore;
import org.finos.calm.store.github.util.InMemoryRegistryService;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

@ApplicationScoped
@Typed(GitHubDecoratorStore.class)
public class GitHubDecoratorStore implements DecoratorStore {

    private static final String WRITE_UNSUPPORTED =
            "Write operations are not yet available. GitHub account linking and PR creation will be enabled in a future release.";

    private final InMemoryRegistryService registryService;

    @Inject
    public GitHubDecoratorStore(InMemoryRegistryService registryService) {
        this.registryService = registryService;
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

    private void verifyNamespace(String namespace) throws NamespaceNotFoundException {
        if (!registryService.getSnapshot().getNamespaces().contains(namespace)) {
            throw new NamespaceNotFoundException();
        }
    }
}
