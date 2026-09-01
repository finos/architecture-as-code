package org.finos.calm.store.github;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.finos.calm.domain.ResourceMapping;
import org.finos.calm.domain.ResourceType;
import org.finos.calm.domain.exception.DuplicateMappingException;
import org.finos.calm.domain.exception.GitHubWriteNotSupportedException;
import org.finos.calm.domain.exception.MappingNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.ResourceMappingStore;
import org.finos.calm.store.github.util.CalmResourceType;
import org.finos.calm.store.github.util.InMemoryRegistryService;
import org.finos.calm.store.github.util.RegistryEntry;

import java.util.List;
import java.util.Optional;

@ApplicationScoped
@Typed(GitHubResourceMappingStore.class)
public class GitHubResourceMappingStore implements ResourceMappingStore {

    private static final String WRITE_UNSUPPORTED =
            "Resource ID mapping is managed by the GitHub repository. Writes are not supported in GitHub storage mode.";

    private final InMemoryRegistryService registryService;

    @Inject
    public GitHubResourceMappingStore(InMemoryRegistryService registryService) {
        this.registryService = registryService;
    }

    @Override
    public ResourceMapping getMapping(String namespace, ResourceType type, String customId)
            throws MappingNotFoundException, NamespaceNotFoundException {
        verifyNamespace(namespace);
        CalmResourceType calmType = toCalmResourceType(type);
        Optional<RegistryEntry> entry = registryService.findByUniqueId(namespace, customId);
        if (entry.isEmpty() || entry.get().type() != calmType) {
            throw new MappingNotFoundException();
        }
        return toResourceMapping(namespace, type, entry.get());
    }

    @Override
    public List<ResourceMapping> listMappings(String namespace, ResourceType typeFilter)
            throws NamespaceNotFoundException {
        verifyNamespace(namespace);
        CalmResourceType calmType = toCalmResourceType(typeFilter);
        return registryService.listByType(namespace, calmType).stream()
                .map(e -> toResourceMapping(namespace, typeFilter, e))
                .toList();
    }

    @Override
    public ResourceMapping getMappingByNumericId(String namespace, ResourceType type, int numericId)
            throws MappingNotFoundException, NamespaceNotFoundException {
        verifyNamespace(namespace);
        CalmResourceType calmType = toCalmResourceType(type);
        Optional<RegistryEntry> found = registryService.listByType(namespace, calmType).stream()
                .filter(e -> (e.uniqueId().hashCode() & 0x7FFFFFFF) == numericId)
                .findFirst();
        if (found.isEmpty()) {
            throw new MappingNotFoundException();
        }
        return toResourceMapping(namespace, type, found.get());
    }

    @Override
    public List<ResourceMapping> listMappingsByNumericIds(String namespace, ResourceType type, List<Integer> ids)
            throws NamespaceNotFoundException {
        verifyNamespace(namespace);
        CalmResourceType calmType = toCalmResourceType(type);
        return registryService.listByType(namespace, calmType).stream()
                .filter(e -> ids.contains(e.uniqueId().hashCode() & 0x7FFFFFFF))
                .map(e -> toResourceMapping(namespace, type, e))
                .toList();
    }

    @Override
    public ResourceMapping createMapping(String namespace, String customId, ResourceType type, int numericId)
            throws DuplicateMappingException, NamespaceNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public void updateMappingNumericId(String namespace, ResourceType type, String customId, int numericId)
            throws MappingNotFoundException, NamespaceNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public void deleteMapping(String namespace, ResourceType type, String customId)
            throws MappingNotFoundException, NamespaceNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    private ResourceMapping toResourceMapping(String namespace, ResourceType type, RegistryEntry entry) {
        return new ResourceMapping.ResourceMappingBuilder()
                .setNamespace(namespace)
                .setCustomId(entry.uniqueId())
                .setResourceType(type)
                .setNumericId(entry.uniqueId().hashCode() & 0x7FFFFFFF)
                .build();
    }

    static CalmResourceType toCalmResourceType(ResourceType type) {
        return switch (type) {
            case PATTERN -> CalmResourceType.PATTERN;
            case ARCHITECTURE -> CalmResourceType.ARCHITECTURE;
            case FLOW -> CalmResourceType.FLOW;
            case STANDARD -> CalmResourceType.STANDARD;
            case INTERFACE -> CalmResourceType.INTERFACE;
            case BUILDING_BLOCK -> CalmResourceType.BUILDING_BLOCK;
            case CONTROL -> CalmResourceType.CONTROL;
        };
    }

    private void verifyNamespace(String namespace) throws NamespaceNotFoundException {
        if (!registryService.getSnapshot().getNamespaces().contains(namespace)) {
            throw new NamespaceNotFoundException();
        }
    }
}
