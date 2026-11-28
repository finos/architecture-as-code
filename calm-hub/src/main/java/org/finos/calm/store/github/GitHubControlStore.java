package org.finos.calm.store.github;

import org.finos.calm.domain.GitHubResourceId;
import org.finos.calm.domain.ResourceId;
import org.finos.calm.domain.ResourceIds;
import org.finos.calm.domain.Tags;
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
import org.finos.calm.store.github.registry.ControlDomains;
import org.finos.calm.store.github.registry.RegistryIdentity;
import org.finos.calm.store.github.registry.RegistryResourceType;
import org.finos.calm.store.github.sync.GitHubCloneManager;
import org.finos.calm.store.github.access.NamespaceFileReader;
import org.finos.calm.store.github.api.GitHubFileHistoryClient;
import org.finos.calm.store.github.registry.ResourceRegistry;
import org.finos.calm.store.github.access.NamespaceAccessFilter;
import org.finos.calm.store.github.registry.RegistryEntry;
import org.finos.calm.store.github.registry.RegistryLookup;
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
                if (domain.equals(ControlDomains.extractDomain(entry))) {
                    results.add(new ControlDetail(
                            entry.stem(), entry.uniqueId(), null, entry.name(), Tags.of(entry.path(), entry.variant())));
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
        return getRequirementVersions(domain, new GitHubResourceId(String.valueOf(controlId), null, null));
    }

    @Override
    public String getRequirementForVersion(String domain, int controlId, String version) throws DomainNotFoundException, ControlNotFoundException, ControlRequirementVersionNotFoundException {
        return getRequirementForVersion(domain, new GitHubResourceId(String.valueOf(controlId), null, null), version);
    }

    @Override
    public List<String> getRequirementVersions(String domain, ResourceId id) throws DomainNotFoundException, ControlNotFoundException {
        RegistryEntry entry = findControlEntry(domain, ResourceIds.github(id));
        String namespace = findNamespaceForControl(entry);
        if (namespace == null) {
            LOG.error("Could not resolve namespace for control [{}] in domain [{}] - registry may be mid-rebuild",
                    entry.uniqueId(), domain);
            throw new ControlNotFoundException();
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
    public String getRequirementForVersion(String domain, ResourceId id, String version) throws DomainNotFoundException, ControlNotFoundException, ControlRequirementVersionNotFoundException {
        RegistryEntry entry = findControlEntry(domain, ResourceIds.github(id));
        String namespace = findNamespaceForControl(entry);
        if (namespace == null) {
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

    // Control configurations have no registry representation - no file convention
    // exists to classify one from a repo checkout, the same shape of gap as
    // GitHubAdrStore/GitHubDecoratorStore. These four are read (GET-backed) methods, so
    // - unlike the write methods below, which correctly throw
    // GitHubWriteNotSupportedException - they answer "none exist" rather than claiming
    // writes are unsupported for a request that was never trying to write.
    @Override
    public List<Integer> getConfigurationsForControl(String domain, int controlId) throws DomainNotFoundException, ControlNotFoundException {
        return getConfigurationsForControl(domain, new GitHubResourceId(String.valueOf(controlId), null, null));
    }

    @Override
    public List<Integer> getConfigurationsForControl(String domain, ResourceId id) throws DomainNotFoundException, ControlNotFoundException {
        findControlEntry(domain, ResourceIds.github(id));
        return List.of();
    }

    @Override
    public List<ControlConfigDetail> getConfigurationDetailsForControl(String domain, int controlId) throws DomainNotFoundException, ControlNotFoundException {
        return getConfigurationDetailsForControl(domain, new GitHubResourceId(String.valueOf(controlId), null, null));
    }

    @Override
    public List<ControlConfigDetail> getConfigurationDetailsForControl(String domain, ResourceId id) throws DomainNotFoundException, ControlNotFoundException {
        findControlEntry(domain, ResourceIds.github(id));
        return List.of();
    }

    @Override
    public int createControlConfiguration(CreateControlConfiguration request, String domain, int controlId) throws DomainNotFoundException, ControlNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public List<String> getConfigurationVersions(String domain, int controlId, int configurationId) throws DomainNotFoundException, ControlNotFoundException, ControlConfigurationNotFoundException {
        return getConfigurationVersions(domain, new GitHubResourceId(String.valueOf(controlId), null, null),
                new GitHubResourceId(String.valueOf(configurationId), null, null));
    }

    @Override
    public List<String> getConfigurationVersions(String domain, ResourceId controlId, ResourceId configId)
            throws DomainNotFoundException, ControlNotFoundException, ControlConfigurationNotFoundException {
        findControlEntry(domain, ResourceIds.github(controlId));
        throw new ControlConfigurationNotFoundException();
    }

    @Override
    public String getConfigurationForVersion(String domain, int controlId, int configurationId, String version) throws DomainNotFoundException, ControlNotFoundException, ControlConfigurationNotFoundException, ControlConfigurationVersionNotFoundException {
        return getConfigurationForVersion(domain, new GitHubResourceId(String.valueOf(controlId), null, null),
                new GitHubResourceId(String.valueOf(configurationId), null, null), version);
    }

    @Override
    public String getConfigurationForVersion(String domain, ResourceId controlId, ResourceId configId, String version)
            throws DomainNotFoundException, ControlNotFoundException, ControlConfigurationNotFoundException, ControlConfigurationVersionNotFoundException {
        findControlEntry(domain, ResourceIds.github(controlId));
        throw new ControlConfigurationNotFoundException();
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

    private RegistryEntry findControlEntry(String domain, GitHubResourceId controlId) throws DomainNotFoundException, ControlNotFoundException {
        Set<String> accessible = accessFilter.getAccessibleNamespaces();
        boolean domainExists = false;
        List<RegistryEntry> matches = new ArrayList<>();
        for (String namespace : registryService.getSnapshot().getNamespaces()) {
            if (!accessible.contains(namespace)) {
                continue;
            }
            List<RegistryEntry> entries = registryService.listByType(namespace, RegistryResourceType.CONTROL);
            for (RegistryEntry entry : entries) {
                boolean inDomain = domain.equals(ControlDomains.extractDomain(entry));
                if (inDomain) {
                    domainExists = true;
                    if (RegistryIdentity.matches(controlId.name(), controlId.path(), controlId.variant(), entry)) {
                        matches.add(entry);
                    }
                }
            }
        }
        if (!domainExists) {
            // The requested domain doesn't exist in any namespace this caller can see -
            // do NOT fall back to scanning every accessible namespace for a coincidental
            // id match regardless of domain. That previously let a caller pass a bogus/wrong
            // domain alongside a real control id from a DIFFERENT domain and get that other
            // domain's content back instead of a 404.
            throw new DomainNotFoundException(domain);
        }
        RegistryEntry match = RegistryLookup.singleOrNull(matches);
        if (match == null) {
            throw new ControlNotFoundException();
        }
        return match;
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
