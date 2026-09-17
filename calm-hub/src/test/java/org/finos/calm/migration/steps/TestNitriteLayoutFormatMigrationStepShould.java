package org.finos.calm.migration.steps;

import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.DocumentCursor;
import org.dizitart.no2.collection.NitriteCollection;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TestNitriteLayoutFormatMigrationStepShould {

    private NitriteCollection layoutCollection;
    private NitriteLayoutFormatMigrationStep step;

    @BeforeEach
    void setup() {
        Nitrite db = mock(Nitrite.class);
        layoutCollection = mock(NitriteCollection.class);
        when(db.getCollection("layouts")).thenReturn(layoutCollection);

        step = new NitriteLayoutFormatMigrationStep(db);
        stubLayouts(List.of());
    }

    private void stubLayouts(List<Document> documents) {
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(layoutCollection.find()).thenReturn(cursor);
        when(cursor.iterator()).thenAnswer(invocation -> documents.iterator());
    }

    private static Document layoutDoc(String layoutJson) {
        return Document.createDocument()
                .put("namespace", "finos")
                .put("architectureId", 1)
                .put("layout", layoutJson);
    }

    @Test
    void run_at_schema_version_fourteen() {
        assertThat(step.fromVersion(), is(14));
    }

    @Test
    void convert_a_legacy_pins_layout_into_the_nodes_map() {
        String legacyJson = """
                {"for":"arch","pins":[{"unique-id":"node-a","position":{"x":10,"y":20}}]}""";
        stubLayouts(List.of(layoutDoc(legacyJson)));

        step.apply();

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(layoutCollection).update(captor.capture());

        String updatedJson = captor.getValue().get("layout", String.class);
        assertThat(updatedJson.contains("\"nodes\""), is(true));
        assertThat(updatedJson.contains("\"pins\""), is(false));
        assertThat(updatedJson.contains("\"node-a\""), is(true));
    }

    @Test
    void ignore_pins_that_are_missing_a_unique_id_or_a_position() {
        String legacyJson = """
                {"for":"arch","pins":[{"unique-id":"node-a","position":{"x":10,"y":20}},{"position":{"x":30,"y":40}},{"unique-id":"node-c"}]}""";
        stubLayouts(List.of(layoutDoc(legacyJson)));

        step.apply();

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(layoutCollection).update(captor.capture());

        String updatedJson = captor.getValue().get("layout", String.class);
        assertThat(updatedJson.contains("\"node-a\""), is(true));
        assertThat(updatedJson.contains("\"node-c\""), is(false));
    }

    @Test
    void skip_a_record_that_has_no_layout_field() {
        Document doc = Document.createDocument().put("namespace", "finos").put("architectureId", 1);
        stubLayouts(List.of(doc));

        step.apply();

        verify(layoutCollection, never()).update(any(Document.class));
    }

    @Test
    void skip_a_layout_that_is_already_in_the_nodes_format() {
        String nodesJson = """
                {"for":"arch","nodes":{"node-a":{"x":1,"y":2}}}""";
        stubLayouts(List.of(layoutDoc(nodesJson)));

        step.apply();

        verify(layoutCollection, never()).update(any(Document.class));
    }

    @Test
    void skip_a_layout_that_has_neither_pins_nor_nodes() {
        String json = """
                {"for":"arch"}""";
        stubLayouts(List.of(layoutDoc(json)));

        step.apply();

        verify(layoutCollection, never()).update(any(Document.class));
    }

    @Test
    void skip_a_layout_with_unparseable_json() {
        Document doc = Document.createDocument()
                .put("namespace", "finos")
                .put("architectureId", 1)
                .put("layout", "{not valid json");
        stubLayouts(List.of(doc));

        step.apply();

        verify(layoutCollection, never()).update(any(Document.class));
    }
}
