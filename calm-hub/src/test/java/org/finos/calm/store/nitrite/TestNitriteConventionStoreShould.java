package org.finos.calm.store.nitrite;

import org.dizitart.no2.Nitrite;
import org.finos.calm.domain.conventions.ConventionDefault;
import org.finos.calm.domain.conventions.ConventionType;
import org.finos.calm.domain.conventions.CreateConventionRequest;
import org.finos.calm.domain.exception.ConventionNotFoundException;
import org.finos.calm.domain.exception.ConventionVersionExistsException;
import org.finos.calm.domain.exception.ConventionVersionNotFoundException;
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

class TestNitriteConventionStoreShould {

    private static final ConventionType C4 = ConventionType.C4_MAPPING;
    private static final CreateConventionRequest V1 = new CreateConventionRequest("Acme", "Acme mapping", "{\"unique-id\":\"v1\"}");
    private static final CreateConventionRequest V2 = new CreateConventionRequest("Acme 2", null, "{\"unique-id\":\"v2\"}");

    private Nitrite database;
    private NitriteNamespaceStore namespaceStore;
    private NitriteConventionStore store;

    @BeforeEach
    void setup() throws Exception {
        database = Nitrite.builder().openOrCreate();
        namespaceStore = mock(NitriteNamespaceStore.class);
        NitriteCounterStore counterStore = mock(NitriteCounterStore.class);
        when(counterStore.getNextConventionSequenceValue()).thenReturn(7, 8);
        doThrow(new NamespaceNotFoundException()).when(namespaceStore).requireNamespace("missing");
        store = new NitriteConventionStore(database, namespaceStore, counterStore);
    }

    @AfterEach
    void close() {
        database.close();
    }

    @Test
    void store_and_read_convention_versions() throws Exception {
        int id = store.createConventionForNamespace(V1, "finos", C4);
        store.createConventionForVersion(V2, "finos", C4, id, "1.1.0");

        assertThat(id, is(7));
        assertThat(store.getConventionVersions("finos", C4, 7), contains("1.0.0", "1.1.0"));
        assertThat(store.getConventionForVersion("finos", C4, 7, "1.0.0"), is(V1.getConventionJson()));
        assertThat(store.getConventionForVersion("finos", C4, 7, "1-1-0"), is(V2.getConventionJson()));
        assertThat(store.getConventionsForNamespace("finos", C4).get(0).getName(), is("Acme 2"));
        assertThat(store.getConventionsForNamespace("finos", C4).get(0).getVersionCount(), is(2));
    }

    @Test
    void keep_versions_immutable() throws Exception {
        store.createConventionForNamespace(V1, "finos", C4);

        assertThrows(ConventionVersionExistsException.class, () -> store.createConventionForVersion(V2, "finos", C4, 7, "1.0.0"));
        assertThat(store.getConventionForVersion("finos", C4, 7, "1.0.0"), is(V1.getConventionJson()));
    }

    @Test
    void report_a_missing_namespace_convention_or_version() throws Exception {
        store.createConventionForNamespace(V1, "finos", C4);

        assertThrows(NamespaceNotFoundException.class, () -> store.getConventionsForNamespace("missing", C4));
        assertThrows(ConventionNotFoundException.class, () -> store.getConventionVersions("finos", C4, 99));
        assertThrows(ConventionNotFoundException.class, () -> store.getConventionVersions("other", C4, 7));
        assertThrows(ConventionVersionNotFoundException.class, () -> store.getConventionForVersion("finos", C4, 7, "2.0.0"));
    }

    @Test
    void replace_the_default_of_a_namespace() throws Exception {
        store.createConventionForNamespace(V1, "finos", C4);
        store.createConventionForVersion(V2, "finos", C4, 7, "1.1.0");

        store.setDefault("finos", C4, 7, "1.0.0");
        ConventionDefault replaced = store.setDefault("finos", C4, 7, "1-1-0");

        assertThat(replaced.version(), is("1.1.0"));
        assertThat(store.getDefault("finos", C4), is(Optional.of(new ConventionDefault("c4-mapping", "finos", 7, "1.1.0"))));
        assertThat(store.readDefault("finos", C4, replaced), is(V2.getConventionJson()));
        assertThat(store.getDefault("finos.child", C4).isPresent(), is(false));
    }

    @Test
    void refuse_a_default_that_names_a_missing_convention_or_version() throws Exception {
        store.createConventionForNamespace(V1, "finos", C4);

        assertThrows(ConventionNotFoundException.class, () -> store.setDefault("finos", C4, 99, "1.0.0"));
        assertThrows(ConventionVersionNotFoundException.class, () -> store.setDefault("finos", C4, 7, "2.0.0"));
        assertThat(store.getDefault("finos", C4).isPresent(), is(false));
    }

    @Test
    void delete_a_default_and_report_content() throws Exception {
        assertThat(store.hasContent("finos"), is(false));
        store.createConventionForNamespace(V1, "finos", C4);
        store.setDefault("finos", C4, 7, "1.0.0");

        assertThat(store.hasContent("finos"), is(true));
        assertThat(store.deleteDefault("finos", C4), is(true));
        assertThat(store.deleteDefault("finos", C4), is(false));
        assertThat(store.getDefault("finos", C4).isPresent(), is(false));
        assertThrows(NamespaceNotFoundException.class, () -> store.deleteDefault("missing", C4));
    }
}
