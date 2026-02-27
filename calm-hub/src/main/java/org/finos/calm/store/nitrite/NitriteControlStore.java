package org.finos.calm.store.nitrite;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.NitriteCollection;
import org.finos.calm.config.StandaloneQualifier;
import org.finos.calm.domain.controls.ControlDetail;
import org.finos.calm.domain.controls.CreateControlRequirement;
import org.finos.calm.domain.exception.ControlConfigurationNotFoundException;
import org.finos.calm.domain.exception.ControlConfigurationVersionNotFoundException;
import org.finos.calm.domain.exception.ControlNotFoundException;
import org.finos.calm.domain.exception.ControlRequirementVersionNotFoundException;
import org.finos.calm.domain.exception.DomainNotFoundException;
import org.finos.calm.store.ControlStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import static org.dizitart.no2.filters.FluentFilter.where;

/**
 * Implementation of the ControlStore interface using NitriteDB.
 * This implementation is used when the application is running in standalone mode.
 */
@ApplicationScoped
@Typed(NitriteControlStore.class)
public class NitriteControlStore implements ControlStore {

    private static final Logger LOG = LoggerFactory.getLogger(NitriteControlStore.class);
    private static final String COLLECTION_NAME = "controls";
    private static final String DOMAIN_FIELD = "domain";
    private static final String CONTROLS_FIELD = "controls";
    private static final String CONTROL_ID_FIELD = "controlId";
    private static final String REQUIREMENT_FIELD = "requirement";
    private static final String CONFIGURATIONS_FIELD = "configurations";
    private static final String CONFIGURATION_ID_FIELD = "configurationId";
    private static final String VERSIONS_FIELD = "versions";

    private final NitriteCollection controlCollection;
    private final NitriteDomainStore domainStore;
    private final NitriteCounterStore counterStore;

    @Inject
    public NitriteControlStore(@StandaloneQualifier Nitrite db, NitriteDomainStore domainStore, NitriteCounterStore counterStore) {
        this.controlCollection = db.getCollection(COLLECTION_NAME);
        this.domainStore = domainStore;
        this.counterStore = counterStore;
        LOG.info("NitriteControlStore initialized with collection: {}", COLLECTION_NAME);
    }

    @Override
    public List<ControlDetail> getControlsForDomain(String domain) throws DomainNotFoundException {
        validateDomain(domain);

        List<ControlDetail> result = new ArrayList<>();
        for (Document domainDoc : controlCollection.find(where(DOMAIN_FIELD).eq(domain))) {
            @SuppressWarnings("unchecked")
            List<Document> controls = (List<Document>) domainDoc.get(CONTROLS_FIELD);
            if (controls == null) {
                continue;
            }
            for (Document control : controls) {
                result.add(new ControlDetail(
                        control.get(CONTROL_ID_FIELD, Integer.class),
                        control.get("name", String.class),
                        control.get("description", String.class)
                ));
            }
        }
        return result;
    }

    @Override
    public ControlDetail createControlRequirement(CreateControlRequirement request, String domain) throws DomainNotFoundException {
        validateDomain(domain);

        int controlId = counterStore.getNextControlSequenceValue();

        Document requirementVersions = Document.createDocument()
                .put("1-0-0", request.getRequirementJson());

        Document controlDoc = Document.createDocument()
                .put(CONTROL_ID_FIELD, controlId)
                .put("name", request.getName())
                .put("description", request.getDescription())
                .put(REQUIREMENT_FIELD, requirementVersions)
                .put(CONFIGURATIONS_FIELD, new ArrayList<>());

        Document existingDoc = controlCollection.find(where(DOMAIN_FIELD).eq(domain)).firstOrNull();

        if (existingDoc == null) {
            List<Document> controls = new ArrayList<>();
            controls.add(controlDoc);
            Document newDoc = Document.createDocument()
                    .put(DOMAIN_FIELD, domain)
                    .put(CONTROLS_FIELD, controls);
            controlCollection.insert(newDoc);
        } else {
            @SuppressWarnings("unchecked")
            List<Document> controls = (List<Document>) existingDoc.get(CONTROLS_FIELD);
            if (controls == null) {
                controls = new ArrayList<>();
            } else {
                controls = new ArrayList<>(controls);
            }
            controls.add(controlDoc);
            existingDoc.put(CONTROLS_FIELD, controls);
            controlCollection.update(where(DOMAIN_FIELD).eq(domain), existingDoc);
        }

        return new ControlDetail(controlId, request.getName(), request.getDescription());
    }

    @Override
    public List<String> getRequirementVersions(String domain, int controlId) throws DomainNotFoundException, ControlNotFoundException {
        Document controlDoc = findControl(domain, controlId);
        Document requirement = controlDoc.get(REQUIREMENT_FIELD, Document.class);
        if (requirement == null) {
            return List.of();
        }

        Set<String> fieldNames = requirement.getFields();
        List<String> versions = new ArrayList<>();
        for (String key : fieldNames) {
            versions.add(key.replace('-', '.'));
        }
        return versions;
    }

    @Override
    public String getRequirementForVersion(String domain, int controlId, String version) throws DomainNotFoundException, ControlNotFoundException, ControlRequirementVersionNotFoundException {
        Document controlDoc = findControl(domain, controlId);
        Document requirement = controlDoc.get(REQUIREMENT_FIELD, Document.class);

        if (requirement == null) {
            throw new ControlRequirementVersionNotFoundException();
        }

        String mongoVersion = version.replace('.', '-');
        String versionJson = requirement.get(mongoVersion, String.class);
        if (versionJson == null) {
            throw new ControlRequirementVersionNotFoundException();
        }

        return versionJson;
    }

    @Override
    public List<Integer> getConfigurationsForControl(String domain, int controlId) throws DomainNotFoundException, ControlNotFoundException {
        Document controlDoc = findControl(domain, controlId);

        @SuppressWarnings("unchecked")
        List<Document> configurations = (List<Document>) controlDoc.get(CONFIGURATIONS_FIELD);
        if (configurations == null) {
            return List.of();
        }

        List<Integer> configIds = new ArrayList<>();
        for (Document config : configurations) {
            configIds.add(config.get(CONFIGURATION_ID_FIELD, Integer.class));
        }
        return configIds;
    }

    @Override
    public List<String> getConfigurationVersions(String domain, int controlId, int configurationId) throws DomainNotFoundException, ControlNotFoundException, ControlConfigurationNotFoundException {
        Document configDoc = findConfiguration(domain, controlId, configurationId);
        Document versions = configDoc.get(VERSIONS_FIELD, Document.class);
        if (versions == null) {
            return List.of();
        }

        List<String> versionList = new ArrayList<>();
        for (String key : versions.getFields()) {
            versionList.add(key.replace('-', '.'));
        }
        return versionList;
    }

    @Override
    public String getConfigurationForVersion(String domain, int controlId, int configurationId, String version) throws DomainNotFoundException, ControlNotFoundException, ControlConfigurationNotFoundException, ControlConfigurationVersionNotFoundException {
        Document configDoc = findConfiguration(domain, controlId, configurationId);
        Document versions = configDoc.get(VERSIONS_FIELD, Document.class);

        if (versions == null) {
            throw new ControlConfigurationVersionNotFoundException();
        }

        String mongoVersion = version.replace('.', '-');
        String versionJson = versions.get(mongoVersion, String.class);
        if (versionJson == null) {
            throw new ControlConfigurationVersionNotFoundException();
        }

        return versionJson;
    }

    private Document findControl(String domain, int controlId) throws DomainNotFoundException, ControlNotFoundException {
        validateDomain(domain);

        Document domainDoc = controlCollection.find(where(DOMAIN_FIELD).eq(domain)).firstOrNull();
        if (domainDoc == null) {
            throw new ControlNotFoundException();
        }

        @SuppressWarnings("unchecked")
        List<Document> controls = (List<Document>) domainDoc.get(CONTROLS_FIELD);
        if (controls == null) {
            throw new ControlNotFoundException();
        }

        for (Document control : controls) {
            if (controlId == control.get(CONTROL_ID_FIELD, Integer.class)) {
                return control;
            }
        }

        throw new ControlNotFoundException();
    }

    private Document findConfiguration(String domain, int controlId, int configurationId) throws DomainNotFoundException, ControlNotFoundException, ControlConfigurationNotFoundException {
        Document controlDoc = findControl(domain, controlId);

        @SuppressWarnings("unchecked")
        List<Document> configurations = (List<Document>) controlDoc.get(CONFIGURATIONS_FIELD);
        if (configurations == null) {
            throw new ControlConfigurationNotFoundException();
        }

        for (Document config : configurations) {
            if (configurationId == config.get(CONFIGURATION_ID_FIELD, Integer.class)) {
                return config;
            }
        }

        throw new ControlConfigurationNotFoundException();
    }

    private void validateDomain(String domain) throws DomainNotFoundException {
        if (!domainStore.getDomains().contains(domain)) {
            throw new DomainNotFoundException(domain);
        }
    }
}
