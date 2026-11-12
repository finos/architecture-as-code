package org.finos.calm.store.nitrite;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.nio.file.Path;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.dizitart.no2.Nitrite;
import org.dizitart.no2.mvstore.MVStoreModule;
import org.finos.calm.domain.Decorator;
import org.finos.calm.domain.exception.DecoratorKeyRefusedException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
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
                "steps": [{"name": "rollout", "ok": true}, "verify"],
                "cost": {"$numberDecimal": "1.5"},
                "big": 123456789012345678901234567890
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

    @ParameterizedTest
    @ValueSource(strings = {"{\"data\": {\"a\\u0000b\": 1}}", "{\"data\": {\"_id\": 5}}", "{\"data\": {\"_id\": \"7\"}}"})
    void keep_keys_that_nitrite_accepts_after_the_database_file_is_reopened(String json) throws Exception {
        Path dbFile = dataDirectory.resolve("decorators.db");

        int id;
        try (Nitrite db = open(dbFile)) {
            id = storeFor(db).createDecorator(NAMESPACE, json);
        }

        try (Nitrite db = open(dbFile)) {
            Decorator decorator = storeFor(db).getDecoratorById(NAMESPACE, id).orElseThrow();

            ObjectMapper mapper = new ObjectMapper();
            assertThat(mapper.valueToTree(decorator.getData()), is(mapper.readTree(json).get("data")));
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"{\"_id\": \"x\"}", "{\"data\": {\"_id\": \"x\"}}", "{\"data\": {\"_id\": null}}",
            "{\"data\": {\"list\": [{\"_id\": {}}]}}", "{\"data\": {\"a._id\": \"x\"}}"})
    void refuse_an_id_key_whose_value_is_not_a_whole_number(String json) throws Exception {
        try (Nitrite db = open(dataDirectory.resolve("decorators.db"))) {
            DecoratorKeyRefusedException e = assertThrows(DecoratorKeyRefusedException.class,
                    () -> storeFor(db).createDecorator(NAMESPACE, json));

            assertThat(e.getMessage(), is(DecoratorKeyRefusedException.idWithAnotherValue().getMessage()));
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"{\"\": 1}", "{\"data\": {\"\": 1}}", "{\"data\": {\".a\": 1}}", "{\"data\": {\"a..b\": 1}}",
            "{\"data\": {\".\": 1}}"})
    void refuse_a_key_with_an_empty_part(String json) throws Exception {
        try (Nitrite db = open(dataDirectory.resolve("decorators.db"))) {
            DecoratorKeyRefusedException e = assertThrows(DecoratorKeyRefusedException.class,
                    () -> storeFor(db).createDecorator(NAMESPACE, json));

            assertThat(e.getMessage(), is(DecoratorKeyRefusedException.emptyKeyPart().getMessage()));
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
