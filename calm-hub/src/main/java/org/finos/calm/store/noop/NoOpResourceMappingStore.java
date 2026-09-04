package org.finos.calm.store.noop;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import org.finos.calm.domain.ResourceMapping;
import org.finos.calm.domain.ResourceType;
import org.finos.calm.domain.exception.DuplicateMappingException;
import org.finos.calm.domain.exception.GitHubWriteNotSupportedException;
import org.finos.calm.domain.exception.MappingNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.ResourceMappingStore;

import java.util.Collections;
import java.util.List;

@ApplicationScoped
@Typed(NoOpResourceMappingStore.class)
public class NoOpResourceMappingStore implements ResourceMappingStore {

    private static final String MESSAGE =
            "Resource ID mapping is not used in GitHub storage mode. Documents are identified by their unique-id field.";

    @Override
    public ResourceMapping createMapping(String namespace, String customId, ResourceType type, int numericId) throws DuplicateMappingException, NamespaceNotFoundException {
        throw new GitHubWriteNotSupportedException(MESSAGE);
    }

    @Override
    public ResourceMapping getMapping(String namespace, ResourceType type, String customId) throws MappingNotFoundException, NamespaceNotFoundException {
        throw new MappingNotFoundException();
    }

    @Override
    public List<ResourceMapping> listMappings(String namespace, ResourceType typeFilter) throws NamespaceNotFoundException {
        return Collections.emptyList();
    }

    @Override
    public ResourceMapping getMappingByNumericId(String namespace, ResourceType type, int numericId) throws MappingNotFoundException, NamespaceNotFoundException {
        throw new MappingNotFoundException();
    }

    @Override
    public List<ResourceMapping> listMappingsByNumericIds(String namespace, ResourceType type, List<Integer> ids) throws NamespaceNotFoundException {
        return Collections.emptyList();
    }

    @Override
    public void updateMappingNumericId(String namespace, ResourceType type, String customId, int numericId) throws MappingNotFoundException, NamespaceNotFoundException {
        throw new GitHubWriteNotSupportedException(MESSAGE);
    }

    @Override
    public void deleteMapping(String namespace, ResourceType type, String customId) throws MappingNotFoundException, NamespaceNotFoundException {
        throw new GitHubWriteNotSupportedException(MESSAGE);
    }

    @Override
    public void deleteMappingByNumericId(String namespace, ResourceType type, int numericId) throws NamespaceNotFoundException {
        throw new GitHubWriteNotSupportedException(MESSAGE);
    }
}
