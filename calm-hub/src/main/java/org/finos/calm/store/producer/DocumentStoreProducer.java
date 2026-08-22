package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.store.DocumentStore;
import org.finos.calm.store.mongo.MongoDocumentStore;
import org.finos.calm.store.nitrite.NitriteDocumentStore;

@ApplicationScoped
public class DocumentStoreProducer {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject Instance<MongoDocumentStore> mongo;

    @Inject Instance<NitriteDocumentStore> nitrite;

    @Produces
    @ApplicationScoped
    public DocumentStore produceDocumentStore() {
        return "standalone".equals(databaseMode) ? nitrite.get() : mongo.get();
    }
}
