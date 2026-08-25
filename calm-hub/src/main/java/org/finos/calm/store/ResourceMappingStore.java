package org.finos.calm.store;

import org.finos.calm.domain.ResourceMapping;
import org.finos.calm.domain.ResourceType;
import org.finos.calm.domain.exception.DuplicateMappingException;
import org.finos.calm.domain.exception.MappingNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;

import java.util.List;

public interface ResourceMappingStore {
    ResourceMapping createMapping(String namespace, String customId, ResourceType type, int numericId) throws DuplicateMappingException, NamespaceNotFoundException;
    ResourceMapping getMapping(String namespace, ResourceType type, String customId) throws MappingNotFoundException, NamespaceNotFoundException;
    List<ResourceMapping> listMappings(String namespace, ResourceType typeFilter) throws NamespaceNotFoundException;
    ResourceMapping getMappingByNumericId(String namespace, ResourceType type, int numericId) throws MappingNotFoundException, NamespaceNotFoundException;
    List<ResourceMapping> listMappingsByNumericIds(String namespace, ResourceType type, List<Integer> ids) throws NamespaceNotFoundException;
    void updateMappingNumericId(String namespace, ResourceType type, String customId, int numericId) throws MappingNotFoundException, NamespaceNotFoundException;
    void deleteMapping(String namespace, ResourceType type, String customId) throws MappingNotFoundException, NamespaceNotFoundException;

    /**
     * Deletes the mapping for a resource by its numeric ID, if one exists.
     *
     * <p>A custom ID exists only for resources written through the name-based ({@code /calm})
     * API, so most numeric-ID resources have no mapping to clean up at all. This is a no-op
     * rather than throwing when nothing matches, so a resource delete can call it
     * unconditionally instead of first checking whether a mapping exists.</p>
     */
    void deleteMappingByNumericId(String namespace, ResourceType type, int numericId) throws NamespaceNotFoundException;
}
