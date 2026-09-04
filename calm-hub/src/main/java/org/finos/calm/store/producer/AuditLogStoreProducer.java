package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.config.DatabaseMode;
import org.finos.calm.store.AuditLogStore;
import org.finos.calm.store.github.GitHubAuditLogStore;
import org.finos.calm.store.mongo.MongoAuditLogStore;
import org.finos.calm.store.nitrite.NitriteAuditLogStore;

@ApplicationScoped
public class AuditLogStoreProducer {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject
    Instance<MongoAuditLogStore> mongoAuditLogStore;

    @Inject
    Instance<NitriteAuditLogStore> standaloneAuditLogStore;

    @Inject
    Instance<GitHubAuditLogStore> gitHubAuditLogStore;

    @Produces
    @ApplicationScoped
    public AuditLogStore produceAuditLogStore() {
        if (DatabaseMode.GITHUB.equals(databaseMode)) {
            return gitHubAuditLogStore.get();
        } else if (DatabaseMode.STANDALONE.equals(databaseMode)) {
            return standaloneAuditLogStore.get();
        } else {
            return mongoAuditLogStore.get();
        }
    }
}
