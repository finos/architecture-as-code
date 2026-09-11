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
import org.finos.calm.store.github.registry.RegistryResourceType;
import org.finos.calm.store.github.sync.GitHubCloneManager;
import org.finos.calm.store.github.access.NamespaceFileReader;
import org.finos.calm.store.github.api.GitHubFileHistoryClient;
import org.finos.calm.store.github.registry.ResourceRegistry;
import org.finos.calm.store.github.registry.RegistryEntry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.List;

/**
 * GitHub-mode {@link FlowStore}: flows are read from the {@code .json} files under
 * {@code flows/} in the namespace's clone, classified into the registry by
 * {@link org.finos.calm.store.github.registry.CalmContentDetector}. Id lookup, version listing
 * and version-content resolution all delegate to {@link AbstractReadOnlyGitHubStore} - see its
 * class javadoc for why an unresolvable version 404s rather than silently reading whatever
 * HEAD holds. Every mutating method throws {@link GitHubWriteNotSupportedException}: this
 * backend is read-only until GitHub account linking and PR creation land.
 */
@ApplicationScoped
@Typed(GitHubFlowStore.class)
public class GitHubFlowStore extends AbstractReadOnlyGitHubStore implements FlowStore {

    private static final Logger LOG = LoggerFactory.getLogger(GitHubFlowStore.class);

    @Inject
    public GitHubFlowStore(ResourceRegistry registryService, GitHubCloneManager cloneManager,
                            GitHubFileHistoryClient versionService, NamespaceFileReader fileReader) {
        super(registryService, cloneManager, versionService, fileReader);
    }

    @Override
    public List<NamespaceResourceSummary> getFlowsForNamespace(String namespace) throws NamespaceNotFoundException {
        verifyNamespace(namespace);
        List<RegistryEntry> entries = registryService.listByType(namespace, RegistryResourceType.FLOW);
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
        verifyNamespace(flow.getNamespace());
        RegistryEntry entry = findEntry(flow.getNamespace(), RegistryResourceType.FLOW, flow.getId())
                .orElseThrow(FlowNotFoundException::new);
        return getVersions(flow.getNamespace(), entry);
    }

    @Override
    public String getFlowForVersion(Flow flow) throws NamespaceNotFoundException, FlowNotFoundException, FlowVersionNotFoundException {
        verifyNamespace(flow.getNamespace());
        RegistryEntry entry = findEntry(flow.getNamespace(), RegistryResourceType.FLOW, flow.getId())
                .orElseThrow(FlowNotFoundException::new);
        try {
            return readAtVersion(flow.getNamespace(), entry, flow.getDotVersion())
                    .orElseThrow(FlowVersionNotFoundException::new);
        } catch (IOException e) {
            LOG.error("Failed to read flow file: {}", entry.filePath(), e);
            throw new FlowVersionNotFoundException();
        }
    }

    @Override
    public Flow createFlowForVersion(Flow flow) throws NamespaceNotFoundException, FlowNotFoundException, FlowVersionExistsException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public Flow updateFlowForVersion(Flow flow) throws NamespaceNotFoundException, FlowNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public void deleteFlow(String namespace, int flowId) throws NamespaceNotFoundException, FlowNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }
}
