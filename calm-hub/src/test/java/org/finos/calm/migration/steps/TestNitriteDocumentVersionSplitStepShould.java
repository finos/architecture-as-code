package org.finos.calm.migration.steps;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.dizitart.no2.filters.FluentFilter.where;

class TestNitriteDocumentVersionSplitStepShould {

    private Nitrite database;

    @BeforeEach
    void setup() {
        database = Nitrite.builder().openOrCreate();
    }

    @AfterEach
    void close() {
        database.close();
    }

    @Test
    void move_embedded_markdown_to_a_type_scoped_version_record() {
        database.getCollection("documents")
                .insert(Document.createDocument()
                        .put("namespace", "finos")
                        .put("documentType", "knowledge")
                        .put("documents", java.util.List.of(Document.createDocument()
                                .put("documentId", 7)
                                .put("name", "Document")
                                .put("description", "Description")
                                .put("versions", Document.createDocument().put("1-0-0", "line1\r\nline2")))));

        new NitriteDocumentVersionSplitStep(database).apply();

        Document header = database.getCollection("documents")
                .find(where("documentId").eq(7))
                .firstOrNull();
        Document version = database.getCollection("documentVersions")
                .find(where("documentId").eq(7))
                .firstOrNull();
        assertThat(header.get("documentType", String.class), is("knowledge"));
        assertThat(version.get("version", String.class), is("1.0.0"));
        assertThat(version.get("content", Document.class).get("documentMarkdown", String.class), is("line1\r\nline2"));
        assertNull(database.getCollection("documents").find().firstOrNull().get("documents"));
    }

    @Test
    void preserve_source_when_canonical_aliases_conflict() {
        Document root = insertRoot(Document.createDocument().put("1-0-0", "original").put("1.0.0", "different"));

        assertThrows(IllegalStateException.class, () -> new NitriteDocumentVersionSplitStep(database).apply());

        assertNotNull(database.getCollection("documents").getById(root.getId()));
        assertThat(database.getCollection("documentVersions").size(), is(0L));
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(ints = {42})
    void preserve_source_when_markdown_is_not_a_string(Integer markdown) {
        Document root = insertRoot(Document.createDocument().put("1-0-0", markdown));

        assertThrows(IllegalStateException.class, () -> new NitriteDocumentVersionSplitStep(database).apply());

        assertNotNull(database.getCollection("documents").getById(root.getId()));
        assertThat(database.getCollection("documentVersions").size(), is(0L));
    }

    @Test
    void merge_identical_aliases_and_allow_repeated_migration() {
        insertRoot(Document.createDocument().put("1-0-0", "same").put("1.0.0", "same"));
        NitriteDocumentVersionSplitStep migration = new NitriteDocumentVersionSplitStep(database);

        migration.apply();
        migration.apply();

        assertThat(database.getCollection("documents").size(), is(1L));
        assertThat(database.getCollection("documents").find().firstOrNull().get("versionCount", Integer.class), is(1));
        assertThat(database.getCollection("documentVersions").size(), is(1L));
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"body"})
    void reject_a_null_first_alias_without_losing_the_source(String secondContent) {
        Document root = insertRoot(Document.createDocument().put("1-0-0", null).put("1.0.0", secondContent));

        IllegalStateException failure = assertThrows(IllegalStateException.class,
                () -> new NitriteDocumentVersionSplitStep(database).apply());

        assertThat(failure.getMessage(), is(secondContent == null ? "Narrative Markdown must be a string"
                : "Conflicting narrative versions for finos/knowledge/7"));
        assertNotNull(database.getCollection("documents").getById(root.getId()));
        assertThat(database.getCollection("documentVersions").size(), is(0L));
    }

    @Test
    void recover_after_partial_migration_without_duplicate_versions() {
        Document oldVersions = Document.createDocument().put("1-0-0", "original\r\n").put("2-0-0", 42);
        Document root = insertRoot(oldVersions);
        NitriteDocumentVersionSplitStep migration = new NitriteDocumentVersionSplitStep(database);

        assertThrows(IllegalStateException.class, migration::apply);
        assertNotNull(database.getCollection("documents").getById(root.getId()));
        assertThat(database.getCollection("documentVersions").size(), is(1L));

        oldVersions.put("2-0-0", "corrected\r\n");
        ((Document) root.get("documents", java.util.List.class).getFirst()).put("versions", oldVersions);
        database.getCollection("documents").update(root);
        migration.apply();
        migration.apply();

        assertNull(database.getCollection("documents").getById(root.getId()));
        assertThat(database.getCollection("documents").size(), is(1L));
        assertThat(database.getCollection("documents").find().firstOrNull().get("versionCount", Integer.class), is(2));
        assertThat(database.getCollection("documentVersions").size(), is(2L));
        assertThat(database.getCollection("documentVersions").find(where("version").eq("1.0.0"))
                .firstOrNull().get("content", Document.class).get("documentMarkdown", String.class), is("original\r\n"));
        assertThat(database.getCollection("documentVersions").find(where("version").eq("2.0.0"))
                .firstOrNull().get("content", Document.class).get("documentMarkdown", String.class), is("corrected\r\n"));
    }

    private Document insertRoot(Document versions) {
        Document root = Document.createDocument().put("namespace", "finos").put("documentType", "knowledge")
                .put("documents", java.util.List.of(Document.createDocument().put("documentId", 7)
                        .put("name", "Document").put("description", "Description").put("versions", versions)));
        database.getCollection("documents").insert(root);
        return database.getCollection("documents").find().firstOrNull();
    }
}
