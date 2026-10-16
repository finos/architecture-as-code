package org.finos.calm.store.producer;

import jakarta.enterprise.inject.Instance;
import org.finos.calm.config.DatabaseMode;
import org.finos.calm.store.TimelineStore;
import org.finos.calm.store.github.GitHubTimelineStore;
import org.finos.calm.store.mongo.MongoTimelineStore;
import org.finos.calm.store.nitrite.NitriteTimelineStore;
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
public class TestTimelineStoreProducerShould {

    @Mock
    MongoTimelineStore mongoTimelineStore;

    @Mock
    Instance<MongoTimelineStore> mongoTimelineStoreInstance;

    @Mock
    NitriteTimelineStore nitriteTimelineStore;

    @Mock
    Instance<NitriteTimelineStore> nitriteTimelineStoreInstance;


    @Mock
    GitHubTimelineStore gitHubTimelineStore;

    @Mock
    Instance<GitHubTimelineStore> gitHubTimelineStoreInstance;
    private TimelineStoreProducer timelineStoreProducer;

    @BeforeEach
    void setup() {
        timelineStoreProducer = new TimelineStoreProducer();
        when(mongoTimelineStoreInstance.get()).thenReturn(mongoTimelineStore);
        timelineStoreProducer.mongoTimelineStore = mongoTimelineStoreInstance;
        when(nitriteTimelineStoreInstance.get()).thenReturn(nitriteTimelineStore);
        timelineStoreProducer.standaloneTimelineStore = nitriteTimelineStoreInstance;
        when(gitHubTimelineStoreInstance.get()).thenReturn(gitHubTimelineStore);
        timelineStoreProducer.gitHubTimelineStore = gitHubTimelineStoreInstance;
    }

    @Test
    void return_mongo_timeline_store_when_database_mode_is_mongo() {
        timelineStoreProducer.databaseMode = "mongo";

        TimelineStore result = timelineStoreProducer.produceTimelineStore();

        assertThat(result, is(sameInstance(mongoTimelineStore)));
    }

    @Test
    void return_nitrite_timeline_store_when_database_mode_is_standalone() {
        timelineStoreProducer.databaseMode = "standalone";

        TimelineStore result = timelineStoreProducer.produceTimelineStore();

        assertThat(result, is(sameInstance(nitriteTimelineStore)));
    }

    @Test
    void return_mongo_timeline_store_when_database_mode_is_not_recognized() {
        timelineStoreProducer.databaseMode = "unknown";

        TimelineStore result = timelineStoreProducer.produceTimelineStore();

        assertThat(result, is(sameInstance(mongoTimelineStore)));
    }

    @Test
    void return_github_timeline_store_when_database_mode_is_github() {
        timelineStoreProducer.databaseMode = DatabaseMode.GITHUB;

        TimelineStore result = timelineStoreProducer.produceTimelineStore();

        assertThat(result, is(sameInstance(gitHubTimelineStore)));
    }
}
