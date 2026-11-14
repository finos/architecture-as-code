package org.finos.calm.migration.steps;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.IndexOptions;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class TestMongoConfigIndexStepShould {

    private interface DocumentMongoCollection extends MongoCollection<Document> {}

    private MongoDatabase database;
    private MongoCollection<Document> configs;
    private MongoCollection<Document> configVersions;
    private MongoCollection<Document> configDefaults;
    private MongoConfigIndexStep step;

    @BeforeEach
    void setup() {
        database = mock(MongoDatabase.class);
        configs = mock(DocumentMongoCollection.class);
        configVersions = mock(DocumentMongoCollection.class);
        configDefaults = mock(DocumentMongoCollection.class);
        when(database.getCollection("configs")).thenReturn(configs);
        when(database.getCollection("configVersions")).thenReturn(configVersions);
        when(database.getCollection("configDefaults")).thenReturn(configDefaults);
        step = new MongoConfigIndexStep(database);
        step.databaseMode = "mongo";
    }

    @Test
    void run_at_schema_version_sixteen() {
        assertThat(step.fromVersion(), is(16));
    }

    @Test
    void skip_index_creation_when_database_mode_is_not_mongo() {
        step.databaseMode = "standalone";

        step.apply();

        verifyNoInteractions(database);
    }

    @Test
    void create_unique_header_version_and_default_indexes() {
        ArgumentCaptor<IndexOptions> options = ArgumentCaptor.forClass(IndexOptions.class);

        step.apply();

        verify(configs).createIndex(eq(new Document("namespace", 1).append("configType", 1).append("configId", 1)),
                options.capture());
        verify(configVersions).createIndex(eq(new Document("namespace", 1).append("configType", 1)
                .append("configId", 1).append("version", 1)), options.capture());
        verify(configDefaults).createIndex(eq(new Document("namespace", 1).append("configType", 1)), options.capture());
        options.getAllValues().forEach(option -> assertThat(option.isUnique(), is(true)));
    }
}
