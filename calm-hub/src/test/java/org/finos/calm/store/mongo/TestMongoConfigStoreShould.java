package org.finos.calm.store.mongo;

import com.mongodb.MongoClientSettings;
import com.mongodb.MongoWriteException;
import com.mongodb.ServerAddress;
import com.mongodb.WriteError;
import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.ReplaceOptions;
import com.mongodb.client.result.DeleteResult;
import com.mongodb.client.result.UpdateResult;
import org.bson.BsonDocument;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.finos.calm.domain.configs.ConfigDefault;
import org.finos.calm.domain.configs.ConfigType;
import org.finos.calm.domain.configs.CreateConfigRequest;
import org.finos.calm.domain.exception.ConfigNotFoundException;
import org.finos.calm.domain.exception.ConfigVersionExistsException;
import org.finos.calm.domain.exception.ConfigVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;
import java.util.function.Consumer;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TestMongoConfigStoreShould {

    private interface DocumentCollection extends MongoCollection<Document> {}
    private interface DocumentIterable extends FindIterable<Document> {}

    private static final ConfigType C4 = ConfigType.C4_MAPPING;
    private static final CreateConfigRequest REQUEST =
            new CreateConfigRequest("Acme", "Acme mapping", "{\"unique-id\": \"acme\", \"node-types\": {}}");

    private MongoCounterStore counterStore;
    private MongoNamespaceStore namespaceStore;
    private MongoCollection<Document> headers;
    private MongoCollection<Document> versions;
    private MongoCollection<Document> defaults;
    private FindIterable<Document> headerFind;
    private FindIterable<Document> versionFind;
    private FindIterable<Document> defaultFind;
    private MongoConfigStore store;

    @BeforeEach
    void setup() throws Exception {
        MongoDatabase database = mock(MongoDatabase.class);
        counterStore = mock(MongoCounterStore.class);
        namespaceStore = mock(MongoNamespaceStore.class);
        headers = mock(DocumentCollection.class);
        versions = mock(DocumentCollection.class);
        defaults = mock(DocumentCollection.class);
        headerFind = mock(DocumentIterable.class);
        versionFind = mock(DocumentIterable.class);
        defaultFind = mock(DocumentIterable.class);
        when(database.getCollection("configs")).thenReturn(headers);
        when(database.getCollection("configVersions")).thenReturn(versions);
        when(database.getCollection("configDefaults")).thenReturn(defaults);
        doThrow(new NamespaceNotFoundException()).when(namespaceStore).requireNamespace("missing");
        when(headers.find(any(Bson.class))).thenReturn(headerFind);
        when(versions.find(any(Bson.class))).thenReturn(versionFind);
        when(defaults.find(any(Bson.class))).thenReturn(defaultFind);
        when(headerFind.projection(any(Bson.class))).thenReturn(headerFind);
        when(headerFind.sort(any(Bson.class))).thenReturn(headerFind);
        when(versionFind.projection(any(Bson.class))).thenReturn(versionFind);
        when(headers.updateOne(any(Bson.class), any(Bson.class))).thenReturn(UpdateResult.acknowledged(1, 1L, null));
        store = new MongoConfigStore(database, counterStore, namespaceStore);
    }

    @Test
    void create_a_config_as_a_typed_header_and_a_parsed_first_version() throws Exception {
        when(counterStore.getNextConfigSequenceValue()).thenReturn(7);

        assertThat(store.createConfigForNamespace(REQUEST, "finos", C4), is(7));

        verify(headers).insertOne(argThat(header -> "c4-mapping".equals(header.getString("configType"))
                && header.getInteger("configId") == 7 && "Acme".equals(header.getString("name"))));
        verify(versions).insertOne(argThat(version -> "1.0.0".equals(version.getString("version"))
                && "c4-mapping".equals(version.getString("configType"))
                && "acme".equals(version.get("content", Document.class).getString("unique-id"))));
    }

    @Test
    void list_configs_and_versions_and_read_a_version_as_json() throws Exception {
        Document header = new Document("configId", 7).append("name", "Acme").append("versionCount", 1);
        when(headerFind.first()).thenReturn(header);
        when(versionFind.first()).thenReturn(new Document("content", new Document("unique-id", "acme")));
        doAnswer(forEach(header)).when(headerFind).forEach(any());
        doAnswer(forEach(new Document("version", "1.0.0"))).when(versionFind).forEach(any());

        assertThat(store.getConfigsForNamespace("finos", C4).get(0).getId(), is(7));
        assertThat(store.getConfigVersions("finos", C4, 7), contains("1.0.0"));
        assertThat(Document.parse(store.getConfigForVersion("finos", C4, 7, "1.0.0")).getString("unique-id"), is("acme"));
        ArgumentCaptor<Bson> listFilter = ArgumentCaptor.forClass(Bson.class);
        verify(headers, org.mockito.Mockito.atLeastOnce()).find(listFilter.capture());
        assertThat(bson(listFilter.getAllValues().get(0)),
                is(bson(Filters.and(Filters.eq("namespace", "finos"), Filters.eq("configType", "c4-mapping")))));
    }

    @Test
    void report_a_missing_namespace_config_or_version() {
        assertThrows(NamespaceNotFoundException.class, () -> store.getConfigsForNamespace("missing", C4));
        when(headerFind.first()).thenReturn(null);
        assertThrows(ConfigNotFoundException.class, () -> store.getConfigVersions("finos", C4, 7));
        when(headerFind.first()).thenReturn(new Document("configId", 7));
        when(versionFind.first()).thenReturn(null);
        assertThrows(ConfigVersionNotFoundException.class, () -> store.getConfigForVersion("finos", C4, 7, "1.0.0"));
        assertThrows(ConfigVersionNotFoundException.class, () -> store.setDefault("finos", C4, 7, "1.0.0"));
        verify(defaults, never()).replaceOne(any(Bson.class), any(Document.class), any(ReplaceOptions.class));
    }

    @Test
    void create_a_version_and_refuse_a_duplicate() throws Exception {
        when(headerFind.first()).thenReturn(new Document("configId", 7));

        store.createConfigForVersion(REQUEST, "finos", C4, 7, "1.1.0");
        verify(versions).insertOne(argThat(version -> "1.1.0".equals(version.getString("version"))));
        // One update counts the version, the other sets the name and description.
        verify(headers, times(2)).updateOne(any(Bson.class), any(Bson.class));

        doThrow(new MongoWriteException(new WriteError(11000, "duplicate key", new BsonDocument()),
                new ServerAddress(), List.of())).when(versions).insertOne(any(Document.class));
        assertThrows(ConfigVersionExistsException.class, () -> store.createConfigForVersion(REQUEST, "finos", C4, 7, "1.1.0"));
        verify(headers, times(2)).updateOne(any(Bson.class), any(Bson.class));
    }

    @Test
    void upsert_one_default_per_namespace_and_type_with_a_canonical_version() throws Exception {
        when(headerFind.first()).thenReturn(new Document("configId", 7));
        when(versionFind.first()).thenReturn(new Document("content", new Document()));

        assertThat(store.setDefault("finos", C4, 7, "1-1-0"), is(new ConfigDefault("c4-mapping", "finos", 7, "1.1.0")));

        ArgumentCaptor<ReplaceOptions> options = ArgumentCaptor.forClass(ReplaceOptions.class);
        verify(defaults).replaceOne(argThat((Bson filter) -> bson(filter).equals(
                        bson(Filters.and(Filters.eq("namespace", "finos"), Filters.eq("configType", "c4-mapping"))))),
                eq(new Document("namespace", "finos").append("configType", "c4-mapping")
                        .append("configId", 7).append("version", "1.1.0")),
                options.capture());
        assertThat(options.getValue().isUpsert(), is(true));
    }

    @Test
    void read_and_delete_a_default() throws Exception {
        when(defaultFind.first()).thenReturn(new Document("configId", 7).append("version", "1.0.0"), (Document) null);
        when(defaults.deleteOne(any(Bson.class))).thenReturn(DeleteResult.acknowledged(1), DeleteResult.acknowledged(0));

        assertThat(store.getDefault("finos", C4), is(Optional.of(new ConfigDefault("c4-mapping", "finos", 7, "1.0.0"))));
        assertThat(store.getDefault("finos", C4).isPresent(), is(false));
        assertThat(store.deleteDefault("finos", C4), is(true));
        assertThat(store.deleteDefault("finos", C4), is(false));
        assertThrows(NamespaceNotFoundException.class, () -> store.deleteDefault("missing", C4));
    }

    @Test
    void report_content_when_the_namespace_has_a_config_or_a_default() {
        when(headers.countDocuments(any(Bson.class))).thenReturn(0L, 1L, 0L);
        when(defaults.countDocuments(any(Bson.class))).thenReturn(0L, 1L);

        assertThat(store.hasContent("finos"), is(false));
        assertThat(store.hasContent("finos"), is(true));
        assertThat(store.hasContent("finos"), is(true));
    }

    private static org.mockito.stubbing.Answer<Void> forEach(Document document) {
        return invocation -> {
            Consumer<Document> consumer = invocation.getArgument(0);
            consumer.accept(document);
            return null;
        };
    }

    private static BsonDocument bson(Bson value) {
        return value.toBsonDocument(Document.class, MongoClientSettings.getDefaultCodecRegistry());
    }
}
