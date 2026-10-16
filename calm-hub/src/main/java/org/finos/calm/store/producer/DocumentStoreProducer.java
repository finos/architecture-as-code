package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.config.DatabaseMode;
import org.finos.calm.store.DocumentStore;
import org.finos.calm.store.github.GitHubDocumentStore;
import org.finos.calm.store.mongo.MongoDocumentStore;
import org.finos.calm.store.nitrite.NitriteDocumentStore;

@ApplicationScoped
public class DocumentStoreProducer {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject Instance<MongoDocumentStore> mongo;

    @Inject Instance<NitriteDocumentStore> nitrite;

    @Inject Instance<GitHubDocumentStore> github;

    @Produces
    @ApplicationScoped
    public DocumentStore produceDocumentStore() {
        if (DatabaseMode.GITHUB.equals(databaseMode)) {
            return github.get();
        } else if (DatabaseMode.STANDALONE.equals(databaseMode)) {
            return nitrite.get();
        }
        return mongo.get();
    }
}
