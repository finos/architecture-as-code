package org.finos.calm.store.github;

import org.finos.calm.domain.exception.GitHubWriteNotSupportedException;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.finos.calm.domain.Domain;
import org.finos.calm.domain.exception.DomainAlreadyExistsException;
import org.finos.calm.domain.exception.DomainNotFoundException;
import org.finos.calm.store.DomainStore;
import org.finos.calm.store.github.registry.RegistryResourceType;
import org.finos.calm.store.github.registry.ControlDomains;
import org.finos.calm.store.github.registry.ResourceRegistry;
import org.finos.calm.store.github.access.NamespaceAccessFilter;

import java.util.List;
import java.util.Set;

/**
 * Domains are derived from the controls/ directory structure in each namespace's repo.
 * E.g. controls/security/*.json -> domain "security".
 */
@ApplicationScoped
@Typed(GitHubDomainStore.class)
public class GitHubDomainStore implements DomainStore {

    private static final String UNSUPPORTED_MSG =
            "Domains in GitHub mode are derived from the controls/ directory structure in the repo.";

    private final ResourceRegistry registryService;

    @Inject
    NamespaceAccessFilter accessFilter;

    @Inject
    public GitHubDomainStore(ResourceRegistry registryService) {
        this.registryService = registryService;
    }

    @Override
    public List<String> getDomains() {
        Set<String> accessible = resolveAccessibleNamespaces();
        return registryService.getSnapshot().entriesByNamespace().entrySet().stream()
                .filter(e -> accessible.contains(e.getKey()))
                .flatMap(e -> e.getValue().stream())
                .filter(entry -> entry.type() == RegistryResourceType.CONTROL)
                .map(ControlDomains::extractDomain)
                .distinct()
                .toList();
    }

    @Override
    public Domain createDomain(String name) throws DomainAlreadyExistsException {
        throw new GitHubWriteNotSupportedException(UNSUPPORTED_MSG);
    }

    @Override
    public boolean domainExists(String name) {
        return getDomains().contains(name);
    }

    @Override
    public void deleteDomain(String name) throws DomainNotFoundException {
        throw new GitHubWriteNotSupportedException(UNSUPPORTED_MSG);
    }

    private Set<String> resolveAccessibleNamespaces() {
        if (accessFilter == null) {
            return new java.util.HashSet<>(registryService.getSnapshot().getNamespaces());
        }
        return accessFilter.getAccessibleNamespaces();
    }
}
