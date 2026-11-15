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

class TestMongoConventionIndexStepShould {

    private interface DocumentMongoCollection extends MongoCollection<Document> {}

    private MongoDatabase database;
    private MongoCollection<Document> conventions;
    private MongoCollection<Document> conventionVersions;
    private MongoCollection<Document> conventionDefaults;
    private MongoConventionIndexStep step;

    @BeforeEach
    void setup() {
        database = mock(MongoDatabase.class);
        conventions = mock(DocumentMongoCollection.class);
        conventionVersions = mock(DocumentMongoCollection.class);
        conventionDefaults = mock(DocumentMongoCollection.class);
        when(database.getCollection("conventions")).thenReturn(conventions);
        when(database.getCollection("conventionVersions")).thenReturn(conventionVersions);
        when(database.getCollection("conventionDefaults")).thenReturn(conventionDefaults);
        step = new MongoConventionIndexStep(database);
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

        verify(conventions).createIndex(eq(new Document("namespace", 1).append("conventionType", 1).append("conventionId", 1)),
                options.capture());
        verify(conventionVersions).createIndex(eq(new Document("namespace", 1).append("conventionType", 1)
                .append("conventionId", 1).append("version", 1)), options.capture());
        verify(conventionDefaults).createIndex(eq(new Document("namespace", 1).append("conventionType", 1)), options.capture());
        options.getAllValues().forEach(option -> assertThat(option.isUnique(), is(true)));
    }
}
