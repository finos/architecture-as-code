package org.finos.calm.store.mongo;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import jakarta.enterprise.context.ApplicationScoped;
import org.bson.Document;
import org.finos.calm.domain.Domain;
import org.finos.calm.domain.exception.DomainAlreadyExistsException;
import org.finos.calm.store.DomainStore;

import java.util.ArrayList;
import java.util.List;

@ApplicationScoped
public class MongoDomainStore implements DomainStore {

    private final MongoCollection<Document> domainsCollection;

    public MongoDomainStore(MongoClient mongoClient) {
        MongoDatabase database = mongoClient.getDatabase("calmSchemas");
        this.domainsCollection = database.getCollection("domains");
    }

    @Override
    public List<String> getDomains() {
        List<String> domains = new ArrayList<>();
        for (Document doc : domainsCollection.find()) {
            domains.add(doc.getString("name"));
        }
        return domains;
    }

    @Override
    public Domain createDomain(String name) throws DomainAlreadyExistsException {
        if (domainExists(name)) {
            throw new DomainAlreadyExistsException("Domain already exists: " + name);
        }

        Document domainDocument = new Document("name", name);
        domainsCollection.insertOne(domainDocument);

        Domain domain = new Domain();
        domain.setName(name);

        return domain;
    }

    private boolean domainExists(String name) {
        Document query = new Document("name", name);
        return domainsCollection.find(query).first() != null;
    }
}
