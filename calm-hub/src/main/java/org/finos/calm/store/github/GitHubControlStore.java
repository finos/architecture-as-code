package org.finos.calm.store.github;

import org.finos.calm.domain.exception.GitHubWriteNotSupportedException;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
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
import org.finos.calm.store.github.util.CalmResourceType;
import org.finos.calm.store.github.util.GitHubCloneManager;
import org.finos.calm.store.github.util.GitHubVersionService;
import org.finos.calm.store.github.util.InMemoryRegistryService;
import org.finos.calm.store.github.util.RegistryEntry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;

@ApplicationScoped
@Typed(GitHubControlStore.class)
public class GitHubControlStore implements ControlStore {

    private static final String WRITE_UNSUPPORTED =
            "Write operations are not yet available. GitHub account linking and PR creation will be enabled in a future release.";

    private static final Logger LOG = LoggerFactory.getLogger(GitHubControlStore.class);

    private final InMemoryRegistryService registryService;

    @Inject
    @ConfigProperty(name = "calm.github.clone-directory", defaultValue = "/tmp/calm-hub-clones")
    String cloneDirectory;

    @Inject
    GitHubCloneManager cloneManager;

    @Inject
    GitHubVersionService versionService;

    @Inject
    public GitHubControlStore(InMemoryRegistryService registryService) {
        this.registryService = registryService;
    }

    @Override
    public List<ControlDetail> getControlsForDomain(String domain) throws DomainNotFoundException {
        // In GitHub mode, "domain" is a subfolder under controls/ within any namespace
        // Search all namespaces for controls whose file path contains controls/{domain}/
        List<ControlDetail> results = new java.util.ArrayList<>();
        for (String namespace : registryService.getSnapshot().getNamespaces()) {
            List<RegistryEntry> entries = registryService.listByType(namespace, CalmResourceType.CONTROL);
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
        String repo = cloneManager != null && namespace != null ? cloneManager.getRepoForNamespace(namespace) : null;
        if (repo != null && versionService != null) {
            return versionService.getFileVersions(repo, entry.filePath().toString());
        }
        return List.of("latest");
    }

    @Override
    public String getRequirementForVersion(String domain, int controlId, String version) throws DomainNotFoundException, ControlNotFoundException, ControlRequirementVersionNotFoundException {
        RegistryEntry entry = findControlEntry(domain, controlId);
        String namespace = findNamespaceForControl(entry);

        // If a specific SHA is requested and version service is available, fetch from GitHub API
        if (version != null && !version.equals("latest") && version.matches("[0-9a-f]{7,40}")
                && cloneManager != null && versionService != null && namespace != null) {
            String repo = cloneManager.getRepoForNamespace(namespace);
            if (repo != null) {
                String content = versionService.getFileAtVersion(repo, entry.filePath().toString(), version);
                if (content != null) {
                    return content;
                }
            }
        }

        // Fallback: read from local clone (latest/HEAD)
        try {
            Path filePath = Path.of(cloneDirectory, namespace != null ? namespace : domain).resolve(entry.filePath());
            return Files.readString(filePath);
        } catch (IOException e) {
            LOG.error("Failed to read control file: {}", entry.filePath(), e);
            throw new ControlRequirementVersionNotFoundException();
        }
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

    private RegistryEntry findControlEntry(String domain, int controlId) throws ControlNotFoundException {
        // Search all namespaces for a control with matching ID in the given domain subfolder
        for (String namespace : registryService.getSnapshot().getNamespaces()) {
            List<RegistryEntry> entries = registryService.listByType(namespace, CalmResourceType.CONTROL);
            for (RegistryEntry entry : entries) {
                String path = entry.filePath().toString();
                boolean inDomain = path.contains("controls/" + domain + "/") || path.contains("controls\\" + domain + "\\");
                if (inDomain && (entry.uniqueId().hashCode() & 0x7FFFFFFF) == controlId) {
                    return entry;
                }
            }
        }
        // Fallback: search by ID across all controls (for namespace-scoped access)
        for (String namespace : registryService.getSnapshot().getNamespaces()) {
            List<RegistryEntry> entries = registryService.listByType(namespace, CalmResourceType.CONTROL);
            Optional<RegistryEntry> found = entries.stream()
                    .filter(e -> (e.uniqueId().hashCode() & 0x7FFFFFFF) == controlId)
                    .findFirst();
            if (found.isPresent()) return found.get();
        }
        throw new ControlNotFoundException();
    }

    private String findNamespaceForControl(RegistryEntry entry) {
        for (String namespace : registryService.getSnapshot().getNamespaces()) {
            List<RegistryEntry> entries = registryService.listByType(namespace, CalmResourceType.CONTROL);
            if (entries.contains(entry)) return namespace;
        }
        return null;
    }
}
