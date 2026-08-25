package org.finos.calm.store.mongo;

import com.mongodb.client.MongoDatabase;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.bson.Document;
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
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.store.ControlStore;
import org.finos.calm.store.PageRequest;
import org.finos.calm.store.util.ControlConfigurationNamespace;
import org.finos.calm.store.util.MongoVersionDocumentStore;

import java.util.ArrayList;
import java.util.List;

import io.quarkus.arc.lookup.LookupIfProperty;

/**
 * MongoDB-backed implementation of {@link ControlStore}.
 *
 * <h2>Document model</h2>
 * Two header/version collection pairs, both driven by {@link MongoVersionDocumentStore} —
 * the same shared helper every other versioned type composes. A control's requirement is
 * keyed by {@code (domain, controlId)} in {@code controls}/{@code controlVersions}, exactly
 * like the other seven types. A configuration is keyed by {@code (domain::controlId,
 * configurationId)} in {@code controlConfigurations}/{@code controlConfigurationVersions} —
 * the synthetic composite namespace scopes listing ("configurations belonging to this
 * control"); uniqueness itself already comes from {@code configurationId} being a global
 * counter. See {@code calm-hub/decisions/0007-control-storage-header-version-split.md}.
 *
 * @see MongoCounterStore
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "mongo", lookupIfMissing = true)
@ApplicationScoped
@Typed(MongoControlStore.class)
public class MongoControlStore implements ControlStore {

    private final MongoCounterStore counterStore;
    private final MongoDomainStore domainStore;
    private final MongoVersionDocumentStore requirementStore;
    private final MongoVersionDocumentStore configurationStore;

    @Inject
    public MongoControlStore(MongoDatabase database, MongoCounterStore counterStore, MongoDomainStore domainStore) {
        this.counterStore = counterStore;
        this.domainStore = domainStore;
        this.requirementStore = new MongoVersionDocumentStore(
                database.getCollection("controls"), database.getCollection("controlVersions"),
                "controlId", "Control");
        this.configurationStore = new MongoVersionDocumentStore(
                database.getCollection("controlConfigurations"), database.getCollection("controlConfigurationVersions"),
                "configurationId", "Configuration");
    }

    @Override
    public List<ControlDetail> getControlsForDomain(String domain) throws DomainNotFoundException {
        validateDomain(domain);

        List<ControlDetail> result = new ArrayList<>();
        for (NamespaceResourceSummary summary : requirementStore.listSummariesPaged(domain, PageRequest.UNPAGED)) {
            String title = titleOf(requirementStore.getLatestVersionContent(domain, summary.getId()));
            result.add(new ControlDetail(summary.getId(), summary.getName(), summary.getDescription(), title));
        }
        return result;
    }

    @Override
    public ControlDetail createControlRequirement(CreateControlRequirement request, String domain) throws DomainNotFoundException {
        validateDomain(domain);

        // Parsed before the counter is drawn and before anything is written, so malformed
        // JSON can't leave a header behind with no version to go with it.
        Document content = Document.parse(request.getRequirementJson());

        int controlId = counterStore.getNextControlSequenceValue();
        requirementStore.createHeader(domain, controlId, request.getName(), request.getDescription());
        requirementStore.createFirstVersion(domain, controlId, content);

        return new ControlDetail(controlId, request.getName(), request.getDescription());
    }

    @Override
    public List<String> getRequirementVersions(String domain, int controlId) throws DomainNotFoundException, ControlNotFoundException {
        requireControl(domain, controlId);
        return requirementStore.listVersions(domain, controlId);
    }

    @Override
    public String getRequirementForVersion(String domain, int controlId, String version) throws DomainNotFoundException, ControlNotFoundException, ControlRequirementVersionNotFoundException {
        requireControl(domain, controlId);

        Document content = requirementStore.getVersion(domain, controlId, version);
        if (content == null) {
            throw new ControlRequirementVersionNotFoundException();
        }
        return content.toJson();
    }

    @Override
    public void createRequirementForVersion(String domain, int controlId, String version, CreateControlRequirement request) throws DomainNotFoundException, ControlNotFoundException, ControlRequirementVersionExistsException {
        requireControl(domain, controlId);

        Document content = Document.parse(request.getRequirementJson());
        boolean created = requirementStore.createVersion(domain, controlId, version, content);
        if (!created) {
            throw new ControlRequirementVersionExistsException();
        }

        // Defensive: the REST layer enforces @NotBlank on name/description via CreateControlRequirement,
        // so a blank value here is only reachable from non-REST callers (e.g. direct store usage in tests).
        requirementStore.updatePresentHeaderDetails(domain, controlId, request.getName(), request.getDescription());
    }

    @Override
    public List<Integer> getConfigurationsForControl(String domain, int controlId) throws DomainNotFoundException, ControlNotFoundException {
        requireControl(domain, controlId);

        List<Integer> configIds = new ArrayList<>();
        for (NamespaceResourceSummary summary
                : configurationStore.listSummariesPaged(configurationNamespace(domain, controlId), PageRequest.UNPAGED)) {
            configIds.add(summary.getId());
        }
        return configIds;
    }

    @Override
    public List<ControlConfigDetail> getConfigurationDetailsForControl(String domain, int controlId) throws DomainNotFoundException, ControlNotFoundException {
        requireControl(domain, controlId);

        String configNamespace = configurationNamespace(domain, controlId);
        List<ControlConfigDetail> details = new ArrayList<>();
        for (NamespaceResourceSummary summary : configurationStore.listSummariesPaged(configNamespace, PageRequest.UNPAGED)) {
            String title = titleOf(configurationStore.getLatestVersionContent(configNamespace, summary.getId()));
            details.add(new ControlConfigDetail(summary.getId(), summary.getName(), title));
        }
        return details;
    }

    @Override
    public int createControlConfiguration(CreateControlConfiguration request, String domain, int controlId) throws DomainNotFoundException, ControlNotFoundException {
        requireControl(domain, controlId);

        Document content = Document.parse(request.getConfigurationJson());

        int configurationId = counterStore.getNextControlConfigurationSequenceValue();
        String configNamespace = configurationNamespace(domain, controlId);
        configurationStore.createHeader(configNamespace, configurationId, request.getName(), null);
        configurationStore.createFirstVersion(configNamespace, configurationId, content);

        return configurationId;
    }

    @Override
    public List<String> getConfigurationVersions(String domain, int controlId, int configurationId) throws DomainNotFoundException, ControlNotFoundException, ControlConfigurationNotFoundException {
        requireConfiguration(domain, controlId, configurationId);
        return configurationStore.listVersions(configurationNamespace(domain, controlId), configurationId);
    }

    @Override
    public String getConfigurationForVersion(String domain, int controlId, int configurationId, String version) throws DomainNotFoundException, ControlNotFoundException, ControlConfigurationNotFoundException, ControlConfigurationVersionNotFoundException {
        requireConfiguration(domain, controlId, configurationId);

        Document content = configurationStore.getVersion(configurationNamespace(domain, controlId), configurationId, version);
        if (content == null) {
            throw new ControlConfigurationVersionNotFoundException();
        }
        return content.toJson();
    }

    @Override
    public void createConfigurationForVersion(String domain, int controlId, int configurationId, String version, CreateControlConfiguration request) throws DomainNotFoundException, ControlNotFoundException, ControlConfigurationNotFoundException, ControlConfigurationVersionExistsException {
        requireConfiguration(domain, controlId, configurationId);

        Document content = Document.parse(request.getConfigurationJson());
        // No header-details update here, matching the old behavior: only a requirement
        // version write syncs the wrapper name/description, a configuration version
        // write never has.
        boolean created = configurationStore.createVersion(
                configurationNamespace(domain, controlId), configurationId, version, content);
        if (!created) {
            throw new ControlConfigurationVersionExistsException();
        }
    }

    @Override
    public void deleteControlRequirement(String domain, int controlId) throws DomainNotFoundException, ControlNotFoundException, ControlHasConfigurationsException {
        requireControl(domain, controlId);

        int configurationCount = configurationStore.countHeaders(configurationNamespace(domain, controlId));
        if (configurationCount > 0) {
            throw new ControlHasConfigurationsException(controlId, configurationCount);
        }

        if (!requirementStore.deleteResource(domain, controlId)) {
            throw new ControlNotFoundException();
        }
    }

    @Override
    public void deleteControlConfiguration(String domain, int controlId, int configurationId) throws DomainNotFoundException, ControlNotFoundException, ControlConfigurationNotFoundException {
        requireConfiguration(domain, controlId, configurationId);

        if (!configurationStore.deleteResource(configurationNamespace(domain, controlId), configurationId)) {
            throw new ControlConfigurationNotFoundException();
        }
    }

    private void requireControl(String domain, int controlId) throws DomainNotFoundException, ControlNotFoundException {
        validateDomain(domain);
        if (!requirementStore.headerExists(domain, controlId)) {
            throw new ControlNotFoundException();
        }
    }

    private void requireConfiguration(String domain, int controlId, int configurationId) throws DomainNotFoundException, ControlNotFoundException, ControlConfigurationNotFoundException {
        requireControl(domain, controlId);
        if (!configurationStore.headerExists(configurationNamespace(domain, controlId), configurationId)) {
            throw new ControlConfigurationNotFoundException();
        }
    }

    /**
     * Configurations are scoped under a synthetic namespace combining the domain and owning
     * control id, so a control's configurations can be listed without a second nesting level
     * — {@code configurationId} is already globally unique (see class javadoc), so this
     * exists purely to scope listing, not to establish uniqueness. {@code ":"} is safe: the
     * domain name pattern ({@code DomainStore}'s validation) disallows it.
     */
    private String configurationNamespace(String domain, int controlId) {
        return ControlConfigurationNamespace.of(domain, controlId);
    }

    private String titleOf(Document content) {
        return content != null ? content.getString("title") : null;
    }

    private void validateDomain(String domain) throws DomainNotFoundException {
        if (!domainStore.getDomains().contains(domain)) {
            throw new DomainNotFoundException(domain);
        }
    }
}
