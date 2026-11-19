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
import org.finos.calm.store.github.registry.RegistryLookup;
import org.finos.calm.store.github.registry.RegistryResourceType;
import org.finos.calm.store.github.registry.ResourceRegistry;
import org.finos.calm.store.github.registry.RegistryEntry;

import java.util.List;
import java.util.Optional;

/**
 * GitHub-mode {@link ResourceMappingStore}, and the one named place that translates between
 * the front controller's {@link ResourceType} and this backend's own
 * {@link RegistryResourceType} ({@link #toRegistryResourceType}). The two types are a
 * deliberate duplication, not an oversight - {@code RegistryResourceType} answers "what kind
 * of file is this" from repo content alone, while {@code ResourceType} answers "what can the
 * namespace-scoped front controller address" and is serialized on {@link ResourceMapping} and
 * name-coupled to {@code AuditEntityType}. Holding the mapping here, rather than inline in
 * each store, keeps that translation a single reviewable switch instead of one copy per
 * resource type.
 */
@ApplicationScoped
@Typed(GitHubResourceMappingStore.class)
public class GitHubResourceMappingStore implements ResourceMappingStore {

    private static final String WRITE_UNSUPPORTED =
            "Resource ID mapping is managed by the GitHub repository. Writes are not supported in GitHub storage mode.";

    private final ResourceRegistry registryService;

    @Inject
    public GitHubResourceMappingStore(ResourceRegistry registryService) {
        this.registryService = registryService;
    }

    @Override
    public ResourceMapping getMapping(String namespace, ResourceType type, String customId)
            throws MappingNotFoundException, NamespaceNotFoundException {
        verifyNamespace(namespace);
        RegistryResourceType calmType = toRegistryResourceType(type);
        RegistryEntry entry = RegistryLookup.singleOrNull(
                registryService.find(namespace, calmType, customId, null, null));
        if (entry == null) {
            throw new MappingNotFoundException();
        }
        return toResourceMapping(namespace, type, entry);
    }

    @Override
    public List<ResourceMapping> listMappings(String namespace, ResourceType typeFilter)
            throws NamespaceNotFoundException {
        verifyNamespace(namespace);
        RegistryResourceType calmType = toRegistryResourceType(typeFilter);
        return registryService.listByType(namespace, calmType).stream()
                .map(e -> toResourceMapping(namespace, typeFilter, e))
                .toList();
    }

    @Override
    public ResourceMapping getMappingByNumericId(String namespace, ResourceType type, int numericId)
            throws MappingNotFoundException, NamespaceNotFoundException {
        verifyNamespace(namespace);
        // GitHub mappings have no numeric id. Callers in this mode resolve by stem/path/variant.
        throw new MappingNotFoundException();
    }

    @Override
    public List<ResourceMapping> listMappingsByNumericIds(String namespace, ResourceType type, List<Integer> ids)
            throws NamespaceNotFoundException {
        verifyNamespace(namespace);
        // No numeric ids exist in GitHub mode; enrichment is skipped for string ids.
        return List.of();
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

    @Override
    public void deleteMappingByNumericId(String namespace, ResourceType type, int numericId)
            throws NamespaceNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    private ResourceMapping toResourceMapping(String namespace, ResourceType type, RegistryEntry entry) {
        return new ResourceMapping.ResourceMappingBuilder()
                .setNamespace(namespace)
                .setCustomId(entry.stem())
                .setResourceType(type)
                .setNumericId(ResourceMapping.NO_NUMERIC_ID)
                .setPath(entry.path())
                .setVariant(entry.variant())
                .build();
    }

    static RegistryResourceType toRegistryResourceType(ResourceType type) {
        return switch (type) {
            case PATTERN -> RegistryResourceType.PATTERN;
            case ARCHITECTURE -> RegistryResourceType.ARCHITECTURE;
            case FLOW -> RegistryResourceType.FLOW;
            case STANDARD -> RegistryResourceType.STANDARD;
            case INTERFACE -> RegistryResourceType.INTERFACE;
            case TIMELINE -> RegistryResourceType.TIMELINE;
        };
    }

    private void verifyNamespace(String namespace) throws NamespaceNotFoundException {
        if (!registryService.getSnapshot().getNamespaces().contains(namespace)) {
            throw new NamespaceNotFoundException();
        }
    }
}
