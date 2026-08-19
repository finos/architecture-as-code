package org.finos.calm.store.github;

import org.finos.calm.domain.exception.GitHubWriteNotSupportedException;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.finos.calm.domain.Flow;
import org.finos.calm.domain.exception.FlowNotFoundException;
import org.finos.calm.domain.exception.FlowVersionExistsException;
import org.finos.calm.domain.exception.FlowVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.flow.CreateFlowRequest;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.store.FlowStore;
import org.finos.calm.store.github.util.CalmResourceType;
import org.finos.calm.store.github.util.InMemoryRegistryService;
import org.finos.calm.store.github.util.RegistryEntry;

import java.util.List;

@ApplicationScoped
@Typed(GitHubFlowStore.class)
public class GitHubFlowStore implements FlowStore {

    private static final String WRITE_UNSUPPORTED =
            "Write operations are not yet available. GitHub account linking and PR creation will be enabled in a future release.";

    private static final String VERSION_UNSUPPORTED =
            "Version history via GitHub API is not yet implemented.";

    private final InMemoryRegistryService registryService;

    @Inject
    public GitHubFlowStore(InMemoryRegistryService registryService) {
        this.registryService = registryService;
    }

    @Override
    public List<NamespaceResourceSummary> getFlowsForNamespace(String namespace) throws NamespaceNotFoundException {
        verifyNamespace(namespace);
        List<RegistryEntry> entries = registryService.listByType(namespace, CalmResourceType.FLOW);
        return entries.stream()
                .map(e -> new NamespaceResourceSummary(e.name(), e.uniqueId(), (e.uniqueId().hashCode() & 0x7FFFFFFF), 0))
                .toList();
    }

    @Override
    public Flow createFlowForNamespace(CreateFlowRequest flowRequest, String namespace) throws NamespaceNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public List<String> getFlowVersions(Flow flow) throws NamespaceNotFoundException, FlowNotFoundException {
        throw new GitHubWriteNotSupportedException(VERSION_UNSUPPORTED);
    }

    @Override
    public String getFlowForVersion(Flow flow) throws NamespaceNotFoundException, FlowNotFoundException, FlowVersionNotFoundException {
        throw new GitHubWriteNotSupportedException(VERSION_UNSUPPORTED);
    }

    @Override
    public Flow createFlowForVersion(Flow flow) throws NamespaceNotFoundException, FlowNotFoundException, FlowVersionExistsException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public Flow updateFlowForVersion(Flow flow) throws NamespaceNotFoundException, FlowNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    private void verifyNamespace(String namespace) throws NamespaceNotFoundException {
        if (!registryService.getSnapshot().getNamespaces().contains(namespace)) {
            throw new NamespaceNotFoundException();
        }
    }
}
