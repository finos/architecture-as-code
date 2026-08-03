package org.finos.calm.migration.steps;

import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.DocumentCursor;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.collection.NitriteId;
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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Adr-specific wiring only — the fan-out is {@link NitriteVersionSplitMigration},
 * exercised in depth by {@code TestNitriteArchitectureVersionSplitStepShould}.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TestNitriteAdrVersionSplitStepShould {

    private NitriteCollection headers;
    private NitriteCollection versions;
    private NitriteAdrVersionSplitStep step;

    @BeforeEach
    void setup() {
        Nitrite db = mock(Nitrite.class);
        headers = mock(NitriteCollection.class);
        versions = mock(NitriteCollection.class);
        when(db.getCollection("adrs")).thenReturn(headers);
        when(db.getCollection("adrVersions")).thenReturn(versions);

        step = new NitriteAdrVersionSplitStep(db);
        stubCollectionContents(List.of());
    }

    private void stubCollectionContents(List<Document> documents) {
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(headers.find()).thenReturn(cursor);
        when(cursor.iterator()).thenAnswer(invocation -> documents.iterator());
        when(headers.getById(any(NitriteId.class))).thenAnswer(invocation -> {
            NitriteId id = invocation.getArgument(0);
            return documents.stream()
                    .filter(document -> id.equals(document.getId()))
                    .findFirst()
                    .orElse(null);
        });
    }

    @Test
    void run_at_schema_version_eight() {
        // Matches the Mongo step's version. The two never coexist — each is gated on a
        // different calm.database.mode.
        assertThat(step.fromVersion(), is(8));
    }

    @Test
    void fan_a_namespace_document_out_into_adr_headers_and_versions() {
        stubCollectionContents(List.of(Document.createDocument()
                .put("namespace", "finos")
                .put("adrs", List.of(Document.createDocument()
                        .put("adrId", 1)
                        .put("name", "Sample")
                        .put("revisions", Document.createDocument().put("1-0-0", "{\"nodes\":[]}"))))));

        step.apply();

        ArgumentCaptor<Document> headerCaptor = ArgumentCaptor.forClass(Document.class);
        verify(headers).insert(headerCaptor.capture());
        assertThat(headerCaptor.getValue().get("adrId", Integer.class), is(1));
        assertThat(headerCaptor.getValue().get("versionCount", Integer.class), is(1));

        ArgumentCaptor<Document> versionCaptor = ArgumentCaptor.forClass(Document.class);
        verify(versions).insert(versionCaptor.capture());
        assertThat(versionCaptor.getValue().get("version", String.class), is("1.0.0"));
        // Content stays a JSON string in this backend.
        assertThat(versionCaptor.getValue().get("content", String.class), is("{\"nodes\":[]}"));
    }
}
