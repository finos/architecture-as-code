package org.finos.calm.store.producer;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.finos.calm.store.TimelineStore;
import org.finos.calm.store.mongo.MongoTimelineStore;
import org.finos.calm.store.nitrite.NitriteTimelineStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.sameInstance;

@QuarkusTest
public class TestTimelineStoreProducerShould {

    @InjectMock
    MongoTimelineStore mongoTimelineStore;

    @InjectMock
    NitriteTimelineStore nitriteTimelineStore;

    private TimelineStoreProducer timelineStoreProducer;

    @BeforeEach
    void setup() {
        timelineStoreProducer = new TimelineStoreProducer();
        timelineStoreProducer.mongoTimelineStore = mongoTimelineStore;
        timelineStoreProducer.standaloneTimelineStore = nitriteTimelineStore;
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
}
