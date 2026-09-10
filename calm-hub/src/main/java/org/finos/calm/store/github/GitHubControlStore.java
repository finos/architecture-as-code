package org.finos.calm.store.github;

import org.finos.calm.domain.exception.GitHubWriteNotSupportedException;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.finos.calm.domain.controls.ControlConfigDetail;
import org.finos.calm.domain.controls.ControlDetail;
import org.finos.calm.domain.controls.CreateControlConfiguration;
import org.finos.calm.domain.controls.CreateControlRequirement;
import org.finos.calm.domain.exception.ControlConfigurationNotFoundException;
import org.finos.calm.domain.exception.ControlConfigurationVersionExistsException;
import org.finos.calm.domain.exception.ControlConfigurationVersionNotFoundException;
import org.finos.calm.domain.exception.ControlHasConfigurationsException;
import org.finos.calm.domain.exception.ControlNotFoundException;
import org.finos.calm.domain.exception.ControlRequirementVersionExistsException;
import org.finos.calm.domain.exception.ControlRequirementVersionNotFoundException;
import org.finos.calm.domain.exception.DomainNotFoundException;
import org.finos.calm.store.ControlStore;
import org.finos.calm.store.github.registry.RegistryResourceType;
import org.finos.calm.store.github.sync.GitHubCloneManager;
import org.finos.calm.store.github.access.NamespaceFileReader;
import org.finos.calm.store.github.api.GitHubFileHistoryClient;
import org.finos.calm.store.github.registry.ResourceRegistry;
import org.finos.calm.store.github.access.NamespaceAccessFilter;
import org.finos.calm.store.github.registry.RegistryEntry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Does not extend {@link AbstractReadOnlyGitHubStore} — controls are looked up by
 * (domain, controlId), not the (namespace, type, id) shape every other read-only GitHub
 * store shares, so {@code findEntry} doesn't apply here. The version-list and
 * read-at-version behaviour (never a fabricated "latest", 404 on an unresolvable version)
 * mirrors {@link AbstractReadOnlyGitHubStore#getVersions} and
 * {@link AbstractReadOnlyGitHubStore#readAtVersion} exactly - see those for why.
 */
@ApplicationScoped
@Typed(GitHubControlStore.class)
public class GitHubControlStore implements ControlStore {

    private static final String WRITE_UNSUPPORTED =
            "Write operations are not yet available. GitHub account linking and PR creation will be enabled in a future release.";
    private static final String SHA_PATTERN = "[0-9a-f]{7,40}";

    private static final Logger LOG = LoggerFactory.getLogger(GitHubControlStore.class);

    private final ResourceRegistry registryService;
    private final GitHubCloneManager cloneManager;
    private final GitHubFileHistoryClient versionService;
    private final NamespaceFileReader fileReader;
    private final NamespaceAccessFilter accessFilter;

    @Inject
    public GitHubControlStore(ResourceRegistry registryService, GitHubCloneManager cloneManager,
                               GitHubFileHistoryClient versionService, NamespaceFileReader fileReader,
                               NamespaceAccessFilter accessFilter) {
        this.registryService = registryService;
        this.cloneManager = cloneManager;
        this.versionService = versionService;
        this.fileReader = fileReader;
        this.accessFilter = accessFilter;
    }

    @Override
    public List<ControlDetail> getControlsForDomain(String domain) throws DomainNotFoundException {
        Set<String> accessible = accessFilter.getAccessibleNamespaces();
        List<ControlDetail> results = new ArrayList<>();
        for (String namespace : registryService.getSnapshot().getNamespaces()) {
            if (!accessible.contains(namespace)) {
                continue;
            }
            List<RegistryEntry> entries = registryService.listByType(namespace, RegistryResourceType.CONTROL);
            for (RegistryEntry entry : entries) {
                String path = entry.filePath().toString();
                if (path.contains("controls/" + domain + "/") || path.contains("controls\\" + domain + "\\")) {
                    results.add(new ControlDetail(
                            (entry.uniqueId().hashCode() & 0x7FFFFFFF),
                            entry.uniqueId(),
                            null,
                            entry.name()));
                }
            }
        }
        if (results.isEmpty()) {
            throw new DomainNotFoundException(domain);
        }
        return results;
    }

    @Override
    public ControlDetail createControlRequirement(CreateControlRequirement request, String domain) throws DomainNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public List<String> getRequirementVersions(String domain, int controlId) throws DomainNotFoundException, ControlNotFoundException {
        RegistryEntry entry = findControlEntry(domain, controlId);
        String namespace = findNamespaceForControl(entry);
        if (namespace == null) {
            return List.of();
        }
        String repo = cloneManager.getRepoForNamespace(namespace);
        String branch = cloneManager.getBranchForNamespace(namespace);
        List<String> versions = (repo != null && branch != null)
                ? versionService.getFileVersions(repo, branch, entry.filePath().toString())
                : List.of();
        if (!versions.isEmpty()) {
            return versions;
        }
        String headSha = cloneManager.headSha(namespace);
        return headSha != null ? List.of(headSha) : List.of();
    }

    @Override
    public String getRequirementForVersion(String domain, int controlId, String version) throws DomainNotFoundException, ControlNotFoundException, ControlRequirementVersionNotFoundException {
        RegistryEntry entry = findControlEntry(domain, controlId);
        String namespace = findNamespaceForControl(entry);
        if (namespace == null) {
            // findControlEntry just found this exact entry by walking the same
            // namespace/CONTROL listing findNamespaceForControl uses, so this only
            // happens on a genuine registry-consistency problem (e.g. a rebuild
            // swapped the snapshot out from under this request). Fail closed rather
            // than fall back to using the caller-supplied domain string as a directory
            // name - domain is not a namespace, and guessing one from the other was the
            // bug here.
            LOG.error("Could not resolve namespace for control [{}] in domain [{}] - registry may be mid-rebuild",
                    entry.uniqueId(), domain);
            throw new ControlRequirementVersionNotFoundException();
        }

        if (version == null || !version.matches(SHA_PATTERN)) {
            throw new ControlRequirementVersionNotFoundException();
        }

        String headSha = cloneManager.headSha(namespace);
        if (version.equals(headSha)) {
            try {
                return fileReader.readContained(namespace, entry.filePath());
            } catch (IOException e) {
                LOG.error("Failed to read control file: {}", entry.filePath(), e);
                throw new ControlRequirementVersionNotFoundException();
            }
        }

        String repo = cloneManager.getRepoForNamespace(namespace);
        String content = repo != null ? versionService.getFileAtVersion(repo, entry.filePath().toString(), version) : null;
        if (content == null) {
            throw new ControlRequirementVersionNotFoundException();
        }
        return content;
    }

    @Override
    public void createRequirementForVersion(String domain, int controlId, String version, CreateControlRequirement request) throws DomainNotFoundException, ControlNotFoundException, ControlRequirementVersionExistsException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public List<Integer> getConfigurationsForControl(String domain, int controlId) throws DomainNotFoundException, ControlNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public List<ControlConfigDetail> getConfigurationDetailsForControl(String domain, int controlId) throws DomainNotFoundException, ControlNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public int createControlConfiguration(CreateControlConfiguration request, String domain, int controlId) throws DomainNotFoundException, ControlNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public List<String> getConfigurationVersions(String domain, int controlId, int configurationId) throws DomainNotFoundException, ControlNotFoundException, ControlConfigurationNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public String getConfigurationForVersion(String domain, int controlId, int configurationId, String version) throws DomainNotFoundException, ControlNotFoundException, ControlConfigurationNotFoundException, ControlConfigurationVersionNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public void createConfigurationForVersion(String domain, int controlId, int configurationId, String version, CreateControlConfiguration request) throws DomainNotFoundException, ControlNotFoundException, ControlConfigurationNotFoundException, ControlConfigurationVersionExistsException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public void deleteControlRequirement(String domain, int controlId) throws DomainNotFoundException, ControlNotFoundException, ControlHasConfigurationsException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public void deleteControlConfiguration(String domain, int controlId, int configurationId) throws DomainNotFoundException, ControlNotFoundException, ControlConfigurationNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    private RegistryEntry findControlEntry(String domain, int controlId) throws DomainNotFoundException, ControlNotFoundException {
        Set<String> accessible = accessFilter.getAccessibleNamespaces();
        boolean domainExists = false;
        for (String namespace : registryService.getSnapshot().getNamespaces()) {
            if (!accessible.contains(namespace)) {
                continue;
            }
            List<RegistryEntry> entries = registryService.listByType(namespace, RegistryResourceType.CONTROL);
            for (RegistryEntry entry : entries) {
                String path = entry.filePath().toString();
                boolean inDomain = path.contains("controls/" + domain + "/") || path.contains("controls\\" + domain + "\\");
                if (inDomain) {
                    domainExists = true;
                    if ((entry.uniqueId().hashCode() & 0x7FFFFFFF) == controlId) {
                        return entry;
                    }
                }
            }
        }
        if (!domainExists) {
            // The requested domain doesn't exist in any namespace this caller can see -
            // do NOT fall back to scanning every accessible namespace for a coincidental
            // controlId hash match regardless of domain. That previously let a caller
            // pass a bogus/wrong domain alongside a real controlId from a DIFFERENT
            // domain and get that other domain's content back instead of a 404 - a
            // cross-domain read, and one that would become live the moment domain grants
            // are scoped independently of namespace access (see getGrantsForUser).
            throw new DomainNotFoundException(domain);
        }
        throw new ControlNotFoundException();
    }

    private String findNamespaceForControl(RegistryEntry entry) {
        Set<String> accessible = accessFilter.getAccessibleNamespaces();
        for (String namespace : registryService.getSnapshot().getNamespaces()) {
            if (!accessible.contains(namespace)) {
                continue;
            }
            List<RegistryEntry> entries = registryService.listByType(namespace, RegistryResourceType.CONTROL);
            if (entries.contains(entry)) return namespace;
        }
        return null;
    }
}
