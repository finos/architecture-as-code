package org.finos.calm.store.producer;

import jakarta.enterprise.inject.Instance;
import org.finos.calm.config.DatabaseMode;
import org.finos.calm.store.AuditLogStore;
import org.finos.calm.store.github.GitHubAuditLogStore;
import org.finos.calm.store.mongo.MongoAuditLogStore;
import org.finos.calm.store.nitrite.NitriteAuditLogStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.sameInstance;
import static org.mockito.Mockito.when;

@MockitoSettings(strictness = Strictness.LENIENT)
@ExtendWith(MockitoExtension.class)
public class TestAuditLogStoreProducerShould {

    @Mock
    MongoAuditLogStore mongoAuditLogStore;

    @Mock
    Instance<MongoAuditLogStore> mongoAuditLogStoreInstance;

    @Mock
    NitriteAuditLogStore nitriteAuditLogStore;

    @Mock
    Instance<NitriteAuditLogStore> nitriteAuditLogStoreInstance;

    @Mock
    GitHubAuditLogStore gitHubAuditLogStore;

    @Mock
    Instance<GitHubAuditLogStore> gitHubAuditLogStoreInstance;

    private AuditLogStoreProducer producer;

    @BeforeEach
    void setup() {
        producer = new AuditLogStoreProducer();
        when(mongoAuditLogStoreInstance.get()).thenReturn(mongoAuditLogStore);
        producer.mongoAuditLogStore = mongoAuditLogStoreInstance;
        when(nitriteAuditLogStoreInstance.get()).thenReturn(nitriteAuditLogStore);
        producer.standaloneAuditLogStore = nitriteAuditLogStoreInstance;
        when(gitHubAuditLogStoreInstance.get()).thenReturn(gitHubAuditLogStore);
        producer.gitHubAuditLogStore = gitHubAuditLogStoreInstance;
    }

    @Test
    void return_mongo_audit_log_store_when_database_mode_is_mongo() {
        producer.databaseMode = "mongo";

        AuditLogStore result = producer.produceAuditLogStore();

        assertThat(result, is(sameInstance(mongoAuditLogStore)));
    }

    @Test
    void return_nitrite_audit_log_store_when_database_mode_is_standalone() {
        producer.databaseMode = "standalone";

        AuditLogStore result = producer.produceAuditLogStore();

        assertThat(result, is(sameInstance(nitriteAuditLogStore)));
    }

    @Test
    void return_mongo_audit_log_store_when_database_mode_is_not_recognized() {
        producer.databaseMode = "unknown";

        AuditLogStore result = producer.produceAuditLogStore();

        assertThat(result, is(sameInstance(mongoAuditLogStore)));
    }

    @Test
    void return_github_audit_log_store_when_database_mode_is_github() {
        producer.databaseMode = DatabaseMode.GITHUB;

        AuditLogStore result = producer.produceAuditLogStore();

        assertThat(result, is(sameInstance(gitHubAuditLogStore)));
    }
}
