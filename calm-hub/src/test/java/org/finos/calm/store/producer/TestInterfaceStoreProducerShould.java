package org.finos.calm.store.producer;

import org.finos.calm.store.InterfaceStore;
import org.finos.calm.store.mongo.MongoInterfaceStore;
import org.finos.calm.store.nitrite.NitriteInterfaceStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.sameInstance;
import jakarta.enterprise.inject.Instance;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import static org.mockito.Mockito.when;
import org.mockito.quality.Strictness;
import org.mockito.junit.jupiter.MockitoSettings;

@MockitoSettings(strictness = Strictness.LENIENT)
@ExtendWith(MockitoExtension.class)
public class TestInterfaceStoreProducerShould {

    @Mock
    MongoInterfaceStore mongoInterfaceStore;

    @Mock
    Instance<MongoInterfaceStore> mongoInterfaceStoreInstance;

    @Mock
    NitriteInterfaceStore nitriteInterfaceStore;

    @Mock
    Instance<NitriteInterfaceStore> nitriteInterfaceStoreInstance;

    private InterfaceStoreProducer interfaceStoreProducer;

    @BeforeEach
    void setup() {
        interfaceStoreProducer = new InterfaceStoreProducer();
        when(mongoInterfaceStoreInstance.get()).thenReturn(mongoInterfaceStore);
        interfaceStoreProducer.mongoInterfaceStore = mongoInterfaceStoreInstance;
        when(nitriteInterfaceStoreInstance.get()).thenReturn(nitriteInterfaceStore);
        interfaceStoreProducer.standaloneInterfaceStore = nitriteInterfaceStoreInstance;
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
