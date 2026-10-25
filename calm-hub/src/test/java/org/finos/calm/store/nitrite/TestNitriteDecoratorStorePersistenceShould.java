package org.finos.calm.store.nitrite;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.nio.file.Path;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.dizitart.no2.Nitrite;
import org.dizitart.no2.mvstore.MVStoreModule;
import org.finos.calm.domain.Decorator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

// An in-memory store never serializes, so only a reopened file shows what Nitrite can read back.
class TestNitriteDecoratorStorePersistenceShould {

    private static final String NAMESPACE = "finos";

    private static final String DECORATOR_JSON = """
            {
              "unique-id": "k8s-deployment",
              "type": "deployment",
              "target": ["/calm/namespaces/finos/architectures/1/versions/1-0-0"],
              "applies-to": ["api-service"],
              "data": {
                "status": "completed",
                "kubernetes": {"cluster": "prod-01", "replicas": 3},
                "steps": [{"name": "rollout", "ok": true}, "verify"]
              }
            }
            """;

    @TempDir
    Path dataDirectory;

    @Test
    void read_a_decorator_with_nested_data_after_the_database_file_is_reopened() throws Exception {
        Path dbFile = dataDirectory.resolve("decorators.db");

        int id;
        try (Nitrite db = open(dbFile)) {
            id = storeFor(db).createDecorator(NAMESPACE, DECORATOR_JSON);
        }

        try (Nitrite db = open(dbFile)) {
            Decorator decorator = storeFor(db).getDecoratorById(NAMESPACE, id).orElseThrow();

            ObjectMapper mapper = new ObjectMapper();
            assertThat(decorator.getUniqueId(), is("k8s-deployment"));
            assertThat(mapper.valueToTree(decorator.getData()), is(mapper.readTree(DECORATOR_JSON).get("data")));
        }
    }

    private static Nitrite open(Path dbFile) {
        return Nitrite.builder()
                .loadModule(MVStoreModule.withConfig().filePath(dbFile.toString()).build())
                .openOrCreate();
    }

    private static NitriteDecoratorStore storeFor(Nitrite db) {
        NitriteCounterStore counterStore = mock(NitriteCounterStore.class);
        when(counterStore.getNextDecoratorSequenceValue()).thenReturn(1);
        return new NitriteDecoratorStore(db, mock(NitriteNamespaceStore.class), counterStore);
    }
}
