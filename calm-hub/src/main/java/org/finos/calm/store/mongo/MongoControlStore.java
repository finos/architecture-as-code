package org.finos.calm.store.mongo;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.UpdateOptions;
import com.mongodb.client.model.Updates;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.bson.Document;
import org.finos.calm.domain.controls.ControlDetail;
import org.finos.calm.domain.controls.CreateControlRequirement;
import org.finos.calm.domain.exception.ControlConfigurationNotFoundException;
import org.finos.calm.domain.exception.ControlConfigurationVersionNotFoundException;
import org.finos.calm.domain.exception.ControlNotFoundException;
import org.finos.calm.domain.exception.ControlRequirementVersionNotFoundException;
import org.finos.calm.domain.exception.DomainNotFoundException;
import org.finos.calm.store.ControlStore;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@ApplicationScoped
@Typed(MongoControlStore.class)
public class MongoControlStore implements ControlStore {

    private final MongoCollection<Document> controlCollection;
    private final MongoCounterStore counterStore;
    private final MongoDomainStore domainStore;

    @Inject
    public MongoControlStore(MongoDatabase database, MongoCounterStore counterStore, MongoDomainStore domainStore) {
        this.controlCollection = database.getCollection("controls");
        this.counterStore = counterStore;
        this.domainStore = domainStore;
    }

    @Override
    public List<ControlDetail> getControlsForDomain(String domain) throws DomainNotFoundException {
        validateDomain(domain);

        Document domainDoc = controlCollection.find(Filters.eq("domain", domain)).first();
        if (domainDoc == null) {
            return List.of();
        }

        List<Document> controls = domainDoc.getList("controls", Document.class);
        if (controls == null) {
            return List.of();
        }

        List<ControlDetail> result = new ArrayList<>();
        for (Document control : controls) {
            result.add(new ControlDetail(
                    control.getInteger("controlId"),
                    control.getString("name"),
                    control.getString("description")
            ));
        }
        return result;
    }

    @Override
    public ControlDetail createControlRequirement(CreateControlRequirement request, String domain) throws DomainNotFoundException {
        validateDomain(domain);

        int controlId = counterStore.getNextControlSequenceValue();

        Document requirementVersions = new Document("1-0-0", Document.parse(request.getRequirementJson()));

        Document controlDoc = new Document("controlId", controlId)
                .append("name", request.getName())
                .append("description", request.getDescription())
                .append("requirement", requirementVersions)
                .append("configurations", new ArrayList<>());

        controlCollection.updateOne(
                Filters.eq("domain", domain),
                Updates.push("controls", controlDoc),
                new UpdateOptions().upsert(true)
        );

        return new ControlDetail(controlId, request.getName(), request.getDescription());
    }

    @Override
    public List<String> getRequirementVersions(String domain, int controlId) throws DomainNotFoundException, ControlNotFoundException {
        Document controlDoc = findControl(domain, controlId);
        Document requirement = (Document) controlDoc.get("requirement");
        if (requirement == null) {
            return List.of();
        }

        Set<String> versionKeys = requirement.keySet();
        List<String> versions = new ArrayList<>();
        for (String key : versionKeys) {
            versions.add(key.replace('-', '.'));
        }
        return versions;
    }

    @Override
    public String getRequirementForVersion(String domain, int controlId, String version) throws DomainNotFoundException, ControlNotFoundException, ControlRequirementVersionNotFoundException {
        Document controlDoc = findControl(domain, controlId);
        Document requirement = (Document) controlDoc.get("requirement");

        if (requirement == null) {
            throw new ControlRequirementVersionNotFoundException();
        }

        String mongoVersion = version.replace('.', '-');
        Document versionDoc = (Document) requirement.get(mongoVersion);
        if (versionDoc == null) {
            throw new ControlRequirementVersionNotFoundException();
        }

        return versionDoc.toJson();
    }

    @Override
    public List<Integer> getConfigurationsForControl(String domain, int controlId) throws DomainNotFoundException, ControlNotFoundException {
        Document controlDoc = findControl(domain, controlId);
        List<Document> configurations = controlDoc.getList("configurations", Document.class);
        if (configurations == null) {
            return List.of();
        }

        List<Integer> configIds = new ArrayList<>();
        for (Document config : configurations) {
            configIds.add(config.getInteger("configurationId"));
        }
        return configIds;
    }

    @Override
    public List<String> getConfigurationVersions(String domain, int controlId, int configurationId) throws DomainNotFoundException, ControlNotFoundException, ControlConfigurationNotFoundException {
        Document configDoc = findConfiguration(domain, controlId, configurationId);
        Document versions = (Document) configDoc.get("versions");
        if (versions == null) {
            return List.of();
        }

        List<String> versionList = new ArrayList<>();
        for (String key : versions.keySet()) {
            versionList.add(key.replace('-', '.'));
        }
        return versionList;
    }

    @Override
    public String getConfigurationForVersion(String domain, int controlId, int configurationId, String version) throws DomainNotFoundException, ControlNotFoundException, ControlConfigurationNotFoundException, ControlConfigurationVersionNotFoundException {
        Document configDoc = findConfiguration(domain, controlId, configurationId);
        Document versions = (Document) configDoc.get("versions");

        if (versions == null) {
            throw new ControlConfigurationVersionNotFoundException();
        }

        String mongoVersion = version.replace('.', '-');
        Document versionDoc = (Document) versions.get(mongoVersion);
        if (versionDoc == null) {
            throw new ControlConfigurationVersionNotFoundException();
        }

        return versionDoc.toJson();
    }

    private Document findControl(String domain, int controlId) throws DomainNotFoundException, ControlNotFoundException {
        validateDomain(domain);

        Document domainDoc = controlCollection.find(Filters.eq("domain", domain)).first();
        if (domainDoc == null) {
            throw new ControlNotFoundException();
        }

        List<Document> controls = domainDoc.getList("controls", Document.class);
        if (controls == null) {
            throw new ControlNotFoundException();
        }

        for (Document control : controls) {
            if (controlId == control.getInteger("controlId")) {
                return control;
            }
        }

        throw new ControlNotFoundException();
    }

    private Document findConfiguration(String domain, int controlId, int configurationId) throws DomainNotFoundException, ControlNotFoundException, ControlConfigurationNotFoundException {
        Document controlDoc = findControl(domain, controlId);

        List<Document> configurations = controlDoc.getList("configurations", Document.class);
        if (configurations == null) {
            throw new ControlConfigurationNotFoundException();
        }

        for (Document config : configurations) {
            if (configurationId == config.getInteger("configurationId")) {
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
