package org.finos.calm.store.producer;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.finos.calm.store.InterfaceStore;
import org.finos.calm.store.mongo.MongoInterfaceStore;
import org.finos.calm.store.nitrite.NitriteInterfaceStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.sameInstance;

@QuarkusTest
public class TestInterfaceStoreProducerShould {

    @InjectMock
    MongoInterfaceStore mongoInterfaceStore;

    @InjectMock
    NitriteInterfaceStore nitriteInterfaceStore;

    private InterfaceStoreProducer interfaceStoreProducer;

    @BeforeEach
    void setup() {
        interfaceStoreProducer = new InterfaceStoreProducer();
        interfaceStoreProducer.mongoInterfaceStore = mongoInterfaceStore;
        interfaceStoreProducer.standaloneInterfaceStore = nitriteInterfaceStore;
    }

    @Test
    void return_mongo_interface_store_when_database_mode_is_mongo() {
        interfaceStoreProducer.databaseMode = "mongo";

        InterfaceStore result = interfaceStoreProducer.produceInterfaceStore();

        assertThat(result, is(sameInstance(mongoInterfaceStore)));
    }

    @Test
    void return_nitrite_interface_store_when_database_mode_is_standalone() {
        interfaceStoreProducer.databaseMode = "standalone";

        InterfaceStore result = interfaceStoreProducer.produceInterfaceStore();

        assertThat(result, is(sameInstance(nitriteInterfaceStore)));
    }

    @Test
    void return_mongo_interface_store_when_database_mode_is_not_recognized() {
        interfaceStoreProducer.databaseMode = "unknown";

        InterfaceStore result = interfaceStoreProducer.produceInterfaceStore();

        assertThat(result, is(sameInstance(mongoInterfaceStore)));
    }
}
