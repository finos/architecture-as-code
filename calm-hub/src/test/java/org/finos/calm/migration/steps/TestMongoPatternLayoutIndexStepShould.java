package org.finos.calm.migration.steps;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TestMongoPatternLayoutIndexStepShould {

    private interface DocumentMongoCollection extends MongoCollection<Document> {
    }

    private MongoDatabase database;
    private MongoCollection<Document> patternLayouts;
    private MongoPatternLayoutIndexStep step;

    @BeforeEach
    void setup() {
        database = mock(MongoDatabase.class);
        patternLayouts = mock(DocumentMongoCollection.class);
        when(database.getCollection("pattern_layouts")).thenReturn(patternLayouts);

        step = new MongoPatternLayoutIndexStep(database);
        step.databaseMode = "mongo";
    }

    @Test
    void run_at_schema_version_eleven() {
        // 10 (MongoAdrTitleBackfillStep) is the highest fromVersion() currently in use; a
        // wrong or duplicate value is a fatal startup IllegalStateException — see
        // SchemaMigrationRunner's duplicate-fromVersion guard.
        assertThat(step.fromVersion(), is(11));
    }

    @Test
    void skip_index_creation_when_database_mode_is_not_mongo() {
        step.databaseMode = "standalone";

        step.apply();

        verifyNoInteractions(database);
    }

    @Test
    void create_the_compound_unique_index_on_pattern_layouts() {
        step.apply();

        verify(patternLayouts).createIndex(eq(new Document("namespace", 1).append("patternId", 1)), any());
    }

    @Test
    void create_indexes_directly_without_needing_the_database_mode_configured() {
        // createIndexes() is the entry point integration-test infrastructure (EndToEndResource)
        // calls directly against a real, known-Mongo container — it must not depend on the
        // CDI-injected databaseMode field, which is never set outside a running application.
        MongoPatternLayoutIndexStep unconfigured = new MongoPatternLayoutIndexStep(database);

        unconfigured.createIndexes();

        verify(patternLayouts).createIndex(eq(new Document("namespace", 1).append("patternId", 1)), any());
    }
}
