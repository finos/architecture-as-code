package org.finos.calm.migration.steps;

import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoCursor;
import com.mongodb.client.MongoDatabase;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.Iterator;
import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TestMongoLayoutFormatMigrationStepShould {

    private interface DocumentMongoCollection extends MongoCollection<Document> {
    }

    private interface DocumentFindIterable extends FindIterable<Document> {
    }

    private interface DocumentMongoCursor extends MongoCursor<Document> {
    }

    private MongoDatabase database;
    private MongoCollection<Document> layouts;
    private MongoLayoutFormatMigrationStep step;

    @BeforeEach
    void setup() {
        database = mock(MongoDatabase.class);
        layouts = mock(DocumentMongoCollection.class);
        when(database.getCollection("layouts")).thenReturn(layouts);

        step = new MongoLayoutFormatMigrationStep(database);
        step.databaseMode = "mongo";
        stubLayouts(List.of());
    }

    /** Backs {@code layouts.find()} with a fresh cursor over the given documents on each call. */
    private void stubLayouts(List<Document> documents) {
        when(layouts.find()).thenAnswer(invocation -> {
            Iterator<Document> iterator = documents.iterator();
            MongoCursor<Document> cursor = mock(DocumentMongoCursor.class);
            when(cursor.hasNext()).thenAnswer(hasNext -> iterator.hasNext());
            when(cursor.next()).thenAnswer(next -> iterator.next());

            FindIterable<Document> iterable = mock(DocumentFindIterable.class);
            when(iterable.iterator()).thenReturn(cursor);
            return iterable;
        });
    }

    private static Document layoutRecord(Document layout) {
        return new Document("_id", new ObjectId()).append("layout", layout);
    }

    /** A legacy pin; a {@code null} uniqueId omits the id and null coordinates omit the position. */
    private static Document pin(String uniqueId, Integer x, Integer y) {
        Document pin = new Document();
        if (uniqueId != null) {
            pin.append("unique-id", uniqueId);
        }
        if (x != null || y != null) {
            pin.append("position", new Document("x", x).append("y", y));
        }
        return pin;
    }

    @Test
    void run_at_schema_version_fourteen() {
        assertThat(step.fromVersion(), is(14));
    }

    @Test
    void skip_the_whole_step_when_not_running_against_mongo() {
        step.databaseMode = "standalone";

        step.apply();

        verifyNoInteractions(database);
    }

    @Test
    void convert_a_legacy_pins_layout_into_the_nodes_map() {
        Document layout = new Document("for", "arch")
                .append("pins", List.of(pin("node-a", 10, 20)));
        stubLayouts(List.of(layoutRecord(layout)));

        step.apply();

        ArgumentCaptor<Document> replacement = ArgumentCaptor.forClass(Document.class);
        verify(layouts).replaceOne(any(Bson.class), replacement.capture());

        Document savedLayout = replacement.getValue().get("layout", Document.class);
        assertThat(savedLayout.containsKey("pins"), is(false));
        Document nodes = savedLayout.get("nodes", Document.class);
        assertThat(nodes.get("node-a"), is(new Document("x", 10).append("y", 20)));
    }

    @Test
    void ignore_pins_that_are_missing_a_unique_id_or_a_position() {
        Document layout = new Document("for", "arch").append("pins", List.of(
                pin("node-a", 10, 20),
                pin(null, 30, 40),
                pin("node-c", null, null)));
        stubLayouts(List.of(layoutRecord(layout)));

        step.apply();

        ArgumentCaptor<Document> replacement = ArgumentCaptor.forClass(Document.class);
        verify(layouts).replaceOne(any(Bson.class), replacement.capture());

        Document nodes = replacement.getValue().get("layout", Document.class).get("nodes", Document.class);
        assertThat(nodes.keySet(), contains("node-a"));
    }

    @Test
    void skip_a_record_that_has_no_layout_field() {
        stubLayouts(List.of(new Document("_id", new ObjectId())));

        step.apply();

        verify(layouts, never()).replaceOne(any(Bson.class), any(Document.class));
    }

    @Test
    void skip_a_layout_that_is_already_in_the_nodes_format() {
        Document layout = new Document("for", "arch")
                .append("nodes", new Document("node-a", new Document("x", 1).append("y", 2)));
        stubLayouts(List.of(layoutRecord(layout)));

        step.apply();

        verify(layouts, never()).replaceOne(any(Bson.class), any(Document.class));
    }

    @Test
    void skip_a_layout_that_has_neither_pins_nor_nodes() {
        stubLayouts(List.of(layoutRecord(new Document("for", "arch"))));

        step.apply();

        verify(layouts, never()).replaceOne(any(Bson.class), any(Document.class));
    }
}
