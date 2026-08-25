package org.finos.calm.store.nitrite;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.dizitart.no2.Nitrite;
import org.finos.calm.config.StandaloneQualifier;
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
import org.finos.calm.store.util.NitriteVersionDocumentStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;

import io.quarkus.arc.lookup.LookupIfProperty;

/**
 * NitriteDB-backed implementation of {@link ControlStore}, used in standalone mode.
 *
 * <h2>Document model</h2>
 * Mirrors {@link org.finos.calm.store.mongo.MongoControlStore}: two header/version
 * collection pairs, both driven by {@link NitriteVersionDocumentStore}. A requirement is
 * keyed by {@code (domain, controlId)}; a configuration is keyed by
 * {@code (domain::controlId, configurationId)} — see that class's javadoc and
 * {@code calm-hub/decisions/0007-control-storage-header-version-split.md} for why the
 * composite namespace is safe and sufficient. Content is stored as a JSON string, matching
 * every other Nitrite store.
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "standalone")
@ApplicationScoped
@Typed(NitriteControlStore.class)
public class NitriteControlStore implements ControlStore {

    private static final Logger LOG = LoggerFactory.getLogger(NitriteControlStore.class);
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final NitriteDomainStore domainStore;
    private final NitriteCounterStore counterStore;
    private final NitriteVersionDocumentStore requirementStore;
    private final NitriteVersionDocumentStore configurationStore;

    @Inject
    public NitriteControlStore(@StandaloneQualifier Nitrite db, NitriteDomainStore domainStore, NitriteCounterStore counterStore) {
        this.domainStore = domainStore;
        this.counterStore = counterStore;
        this.requirementStore = new NitriteVersionDocumentStore(
                db.getCollection("controls"), db.getCollection("controlVersions"), "controlId", "Control");
        this.configurationStore = new NitriteVersionDocumentStore(
                db.getCollection("controlConfigurations"), db.getCollection("controlConfigurationVersions"),
                "configurationId", "Configuration");
        LOG.info("NitriteControlStore initialized with collections: controls / controlVersions / "
                + "controlConfigurations / controlConfigurationVersions");
    }

    @Override
    public List<ControlDetail> getControlsForDomain(String domain) throws DomainNotFoundException {
        validateDomain(domain);

        List<ControlDetail> result = new ArrayList<>();
        for (NamespaceResourceSummary summary : requirementStore.listSummariesPaged(domain, PageRequest.UNPAGED)) {
            String title = titleFromJsonString(requirementStore.getLatestVersionContent(domain, summary.getId()));
            result.add(new ControlDetail(summary.getId(), summary.getName(), summary.getDescription(), title));
        }
        return result;
    }

    @Override
    public ControlDetail createControlRequirement(CreateControlRequirement request, String domain) throws DomainNotFoundException {
        validateDomain(domain);

        int controlId = counterStore.getNextControlSequenceValue();
        requirementStore.createHeader(domain, controlId, request.getName(), request.getDescription());
        requirementStore.createFirstVersion(domain, controlId, request.getRequirementJson());

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

        String content = requirementStore.getVersion(domain, controlId, version);
        if (content == null) {
            throw new ControlRequirementVersionNotFoundException();
        }
        return content;
    }

    @Override
    public void createRequirementForVersion(String domain, int controlId, String version, CreateControlRequirement request) throws DomainNotFoundException, ControlNotFoundException, ControlRequirementVersionExistsException {
        requireControl(domain, controlId);

        boolean created = requirementStore.createVersion(domain, controlId, version, request.getRequirementJson());
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
            String title = titleFromJsonString(configurationStore.getLatestVersionContent(configNamespace, summary.getId()));
            details.add(new ControlConfigDetail(summary.getId(), summary.getName(), title));
        }
        return details;
    }

    @Override
    public int createControlConfiguration(CreateControlConfiguration request, String domain, int controlId) throws DomainNotFoundException, ControlNotFoundException {
        requireControl(domain, controlId);

        int configurationId = counterStore.getNextControlConfigurationSequenceValue();
        String configNamespace = configurationNamespace(domain, controlId);
        configurationStore.createHeader(configNamespace, configurationId, request.getName(), null);
        configurationStore.createFirstVersion(configNamespace, configurationId, request.getConfigurationJson());

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

        String content = configurationStore.getVersion(configurationNamespace(domain, controlId), configurationId, version);
        if (content == null) {
            throw new ControlConfigurationVersionNotFoundException();
        }
        return content;
    }

    @Override
    public void createConfigurationForVersion(String domain, int controlId, int configurationId, String version, CreateControlConfiguration request) throws DomainNotFoundException, ControlNotFoundException, ControlConfigurationNotFoundException, ControlConfigurationVersionExistsException {
        requireConfiguration(domain, controlId, configurationId);

        // No header-details update here, matching the old behavior: only a requirement
        // version write syncs the wrapper name/description, a configuration version
        // write never has.
        boolean created = configurationStore.createVersion(
                configurationNamespace(domain, controlId), configurationId, version, request.getConfigurationJson());
        if (!created) {
            throw new ControlConfigurationVersionExistsException();
        }
    }

    /**
     * Refuses to delete a control requirement that still has configurations, rather than
     * cascading — see {@link ControlHasConfigurationsException}.
     *
     * <p><b>Known, accepted race</b>: same non-atomic count-then-delete as
     * {@code MongoControlStore#deleteControlRequirement} — see that method's javadoc.
     * {@code configurationStore} and {@code requirementStore} are two separate
     * {@link NitriteVersionDocumentStore} instances, each with its own internal lock, so
     * neither one's locking closes the gap between the count and the delete below.</p>
     */
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
        LOG.info("Deleted control requirement {} from domain '{}'", controlId, domain);
    }

    @Override
    public void deleteControlConfiguration(String domain, int controlId, int configurationId) throws DomainNotFoundException, ControlNotFoundException, ControlConfigurationNotFoundException {
        requireConfiguration(domain, controlId, configurationId);

        if (!configurationStore.deleteResource(configurationNamespace(domain, controlId), configurationId)) {
            throw new ControlConfigurationNotFoundException();
        }
        LOG.info("Deleted configuration {} from control {} in domain '{}'", configurationId, controlId, domain);
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
     * Same composite-namespace reasoning as {@code MongoControlStore}'s equivalent private
     * method — identical value on both backends.
     */
    private String configurationNamespace(String domain, int controlId) {
        return ControlConfigurationNamespace.of(domain, controlId);
    }

    private String titleFromJsonString(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            JsonNode node = OBJECT_MAPPER.readTree(json);
            JsonNode titleNode = node.get("title");
            return (titleNode != null && titleNode.isTextual()) ? titleNode.asText() : null;
        } catch (Exception e) {
            LOG.debug("Could not parse version JSON to extract title", e);
            return null;
        }
    }

    private void validateDomain(String domain) throws DomainNotFoundException {
        if (!domainStore.getDomains().contains(domain)) {
            throw new DomainNotFoundException(domain);
        }
    }
}
