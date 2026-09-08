package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.config.DatabaseMode;
import org.finos.calm.store.TimelineStore;
import org.finos.calm.store.github.GitHubTimelineStore;
import org.finos.calm.store.mongo.MongoTimelineStore;
import org.finos.calm.store.nitrite.NitriteTimelineStore;

@ApplicationScoped
public class TimelineStoreProducer {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject
    Instance<MongoTimelineStore> mongoTimelineStore;

    @Inject
    Instance<NitriteTimelineStore> standaloneTimelineStore;

    @Inject
    Instance<GitHubTimelineStore> gitHubTimelineStore;

    @Produces
    @ApplicationScoped
    public TimelineStore produceTimelineStore() {
        if (DatabaseMode.GITHUB.equals(databaseMode)) {
            return gitHubTimelineStore.get();
        } else if (DatabaseMode.STANDALONE.equals(databaseMode)) {
            return standaloneTimelineStore.get();
        } else {
            return mongoTimelineStore.get();
        }
    }
}
