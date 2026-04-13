package org.finos.calm.store;

import org.finos.calm.domain.ResourceMapping;
import org.finos.calm.domain.ResourceType;
import org.finos.calm.domain.exception.DuplicateMappingException;
import org.finos.calm.domain.exception.MappingNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;

import java.util.List;

public interface ResourceMappingStore {
    ResourceMapping createMapping(String namespace, String customId, ResourceType type, int numericId) throws DuplicateMappingException, NamespaceNotFoundException;
    ResourceMapping getMapping(String namespace, String customId) throws MappingNotFoundException, NamespaceNotFoundException;
    List<ResourceMapping> listMappings(String namespace, ResourceType typeFilter) throws NamespaceNotFoundException;
    ResourceMapping getMappingByNumericId(String namespace, ResourceType type, int numericId) throws MappingNotFoundException, NamespaceNotFoundException;
    List<ResourceMapping> listMappingsByNumericIds(String namespace, ResourceType type, List<Integer> ids) throws NamespaceNotFoundException;
    void updateMappingNumericId(String namespace, String customId, int numericId) throws MappingNotFoundException, NamespaceNotFoundException;
    void deleteMapping(String namespace, String customId) throws MappingNotFoundException, NamespaceNotFoundException;
}
