package org.finos.calm.store.github;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.finos.calm.domain.Domain;
import org.finos.calm.domain.exception.DomainAlreadyExistsException;
import org.finos.calm.domain.exception.DomainNotFoundException;
import org.finos.calm.store.DomainStore;
import org.finos.calm.store.github.util.CalmResourceType;
import org.finos.calm.store.github.util.InMemoryRegistryService;
import org.finos.calm.store.github.util.RegistryEntry;

import java.nio.file.Path;
import java.util.List;

/**
 * Domains are derived from the controls/ directory structure in each namespace's repo.
 * E.g. controls/security/*.json -> domain "security".
 */
@ApplicationScoped
@Typed(GitHubDomainStore.class)
public class GitHubDomainStore implements DomainStore {

    private static final String UNSUPPORTED_MSG =
            "Domains in GitHub mode are derived from the controls/ directory structure in the repo.";

    private final InMemoryRegistryService registryService;

    @Inject
    public GitHubDomainStore(InMemoryRegistryService registryService) {
        this.registryService = registryService;
    }

    @Override
    public List<String> getDomains() {
        return registryService.getSnapshot().entriesByType()
                .getOrDefault(CalmResourceType.CONTROL, List.of())
                .stream()
                .map(this::extractDomain)
                .distinct()
                .toList();
    }

    @Override
    public Domain createDomain(String name) throws DomainAlreadyExistsException {
        throw new UnsupportedOperationException(UNSUPPORTED_MSG);
    }

    @Override
    public boolean domainExists(String name) {
        return getDomains().contains(name);
    }

    @Override
    public void deleteDomain(String name) throws DomainNotFoundException {
        throw new UnsupportedOperationException(UNSUPPORTED_MSG);
    }

    private String extractDomain(RegistryEntry entry) {
        Path filePath = entry.filePath();
        if (filePath.getNameCount() >= 2) {
            String firstDir = filePath.getName(0).toString();
            if ("controls".equals(firstDir)) {
                return filePath.getName(1).toString();
            }
        }
        return "default";
    }
}
