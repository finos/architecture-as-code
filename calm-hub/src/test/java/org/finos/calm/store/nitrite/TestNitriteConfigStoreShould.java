package org.finos.calm.store.nitrite;

import org.dizitart.no2.Nitrite;
import org.finos.calm.domain.configs.ConfigDefault;
import org.finos.calm.domain.configs.ConfigType;
import org.finos.calm.domain.configs.CreateConfigRequest;
import org.finos.calm.domain.exception.ConfigNotFoundException;
import org.finos.calm.domain.exception.ConfigVersionExistsException;
import org.finos.calm.domain.exception.ConfigVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TestNitriteConfigStoreShould {

    private static final ConfigType C4 = ConfigType.C4_MAPPING;
    private static final CreateConfigRequest V1 = new CreateConfigRequest("Acme", "Acme mapping", "{\"unique-id\":\"v1\"}");
    private static final CreateConfigRequest V2 = new CreateConfigRequest("Acme 2", null, "{\"unique-id\":\"v2\"}");

    private Nitrite database;
    private NitriteNamespaceStore namespaceStore;
    private NitriteConfigStore store;

    @BeforeEach
    void setup() throws Exception {
        database = Nitrite.builder().openOrCreate();
        namespaceStore = mock(NitriteNamespaceStore.class);
        NitriteCounterStore counterStore = mock(NitriteCounterStore.class);
        when(counterStore.getNextConfigSequenceValue()).thenReturn(7, 8);
        doThrow(new NamespaceNotFoundException()).when(namespaceStore).requireNamespace("missing");
        store = new NitriteConfigStore(database, namespaceStore, counterStore);
    }

    @AfterEach
    void close() {
        database.close();
    }

    @Test
    void store_and_read_config_versions() throws Exception {
        int id = store.createConfigForNamespace(V1, "finos", C4);
        store.createConfigForVersion(V2, "finos", C4, id, "1.1.0");

        assertThat(id, is(7));
        assertThat(store.getConfigVersions("finos", C4, 7), contains("1.0.0", "1.1.0"));
        assertThat(store.getConfigForVersion("finos", C4, 7, "1.0.0"), is(V1.getConfigJson()));
        assertThat(store.getConfigForVersion("finos", C4, 7, "1-1-0"), is(V2.getConfigJson()));
        assertThat(store.getConfigsForNamespace("finos", C4).get(0).getName(), is("Acme 2"));
        assertThat(store.getConfigsForNamespace("finos", C4).get(0).getVersionCount(), is(2));
    }

    @Test
    void keep_versions_immutable() throws Exception {
        store.createConfigForNamespace(V1, "finos", C4);

        assertThrows(ConfigVersionExistsException.class, () -> store.createConfigForVersion(V2, "finos", C4, 7, "1.0.0"));
        assertThat(store.getConfigForVersion("finos", C4, 7, "1.0.0"), is(V1.getConfigJson()));
    }

    @Test
    void report_a_missing_namespace_config_or_version() throws Exception {
        store.createConfigForNamespace(V1, "finos", C4);

        assertThrows(NamespaceNotFoundException.class, () -> store.getConfigsForNamespace("missing", C4));
        assertThrows(ConfigNotFoundException.class, () -> store.getConfigVersions("finos", C4, 99));
        assertThrows(ConfigNotFoundException.class, () -> store.getConfigVersions("other", C4, 7));
        assertThrows(ConfigVersionNotFoundException.class, () -> store.getConfigForVersion("finos", C4, 7, "2.0.0"));
    }

    @Test
    void replace_the_default_of_a_namespace() throws Exception {
        store.createConfigForNamespace(V1, "finos", C4);
        store.createConfigForVersion(V2, "finos", C4, 7, "1.1.0");

        store.setDefault("finos", C4, 7, "1.0.0");
        ConfigDefault replaced = store.setDefault("finos", C4, 7, "1-1-0");

        assertThat(replaced.version(), is("1.1.0"));
        assertThat(store.getDefault("finos", C4), is(Optional.of(new ConfigDefault("c4-mapping", "finos", 7, "1.1.0"))));
        assertThat(store.getDefault("finos.child", C4).isPresent(), is(false));
    }

    @Test
    void refuse_a_default_that_names_a_missing_config_or_version() throws Exception {
        store.createConfigForNamespace(V1, "finos", C4);

        assertThrows(ConfigNotFoundException.class, () -> store.setDefault("finos", C4, 99, "1.0.0"));
        assertThrows(ConfigVersionNotFoundException.class, () -> store.setDefault("finos", C4, 7, "2.0.0"));
        assertThat(store.getDefault("finos", C4).isPresent(), is(false));
    }

    @Test
    void delete_a_default_and_report_content() throws Exception {
        assertThat(store.hasContent("finos"), is(false));
        store.createConfigForNamespace(V1, "finos", C4);
        store.setDefault("finos", C4, 7, "1.0.0");

        assertThat(store.hasContent("finos"), is(true));
        assertThat(store.deleteDefault("finos", C4), is(true));
        assertThat(store.deleteDefault("finos", C4), is(false));
        assertThat(store.getDefault("finos", C4).isPresent(), is(false));
        assertThrows(NamespaceNotFoundException.class, () -> store.deleteDefault("missing", C4));
    }
}
