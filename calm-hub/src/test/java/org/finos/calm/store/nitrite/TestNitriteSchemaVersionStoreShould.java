package org.finos.calm.store.nitrite;

import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.DocumentCursor;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.filters.Filter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestNitriteSchemaVersionStoreShould {

    @Mock
    private Nitrite mockDb;

    @Mock
    private NitriteCollection mockCollection;

    @Mock
    private DocumentCursor mockCursor;

    private NitriteSchemaVersionStore store;

    @BeforeEach
    void setup() {
        when(mockDb.getCollection("calm")).thenReturn(mockCollection);
        store = new NitriteSchemaVersionStore(mockDb);
    }

    @Test
    void return_zero_when_no_schema_version_document_exists() {
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.firstOrNull()).thenReturn(null);

        assertThat(store.getSchemaVersion(), is(0));
    }

    @Test
    void return_zero_when_the_schema_version_document_has_no_version_field() {
        Document doc = mock(Document.class);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.firstOrNull()).thenReturn(doc);
        when(doc.get("version", Integer.class)).thenReturn(null);

        assertThat(store.getSchemaVersion(), is(0));
    }

    @Test
    void return_the_stored_version_when_a_schema_version_document_exists() {
        Document doc = mock(Document.class);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.firstOrNull()).thenReturn(doc);
        when(doc.get("version", Integer.class)).thenReturn(4);

        assertThat(store.getSchemaVersion(), is(4));
    }

    @Test
    void insert_a_new_document_when_setting_the_version_and_none_exists() {
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.firstOrNull()).thenReturn(null);

        store.setSchemaVersion(1);

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(mockCollection).insert(captor.capture());
        assertThat(captor.getValue().get("documentId", String.class), is("schemaVersion"));
        assertThat(captor.getValue().get("version", Integer.class), is(1));
    }

    @Test
    void update_the_existing_document_when_setting_the_version_and_one_exists() {
        Document doc = mock(Document.class);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.firstOrNull()).thenReturn(doc);

        store.setSchemaVersion(5);

        verify(doc).put("version", 5);
        verify(mockCollection).update(doc);
    }

    @Test
    void acquire_the_lock_when_no_lock_document_exists() {
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.firstOrNull()).thenReturn(null);

        assertThat(store.acquireMigrationLock("instance-a"), is(true));

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(mockCollection).insert(captor.capture());
        assertThat(captor.getValue().get("documentId", String.class), is("migrationLock"));
        assertThat(captor.getValue().get("holder", String.class), is("instance-a"));
    }

    @Test
    void acquire_the_lock_when_the_lock_document_exists_but_has_no_holder() {
        Document doc = mock(Document.class);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.firstOrNull()).thenReturn(doc);
        when(doc.get("holder", String.class)).thenReturn(null);

        assertThat(store.acquireMigrationLock("instance-a"), is(true));

        verify(doc).put("holder", "instance-a");
        verify(mockCollection).update(doc);
    }

    @Test
    void not_acquire_the_lock_when_another_instance_already_holds_it() {
        Document doc = mock(Document.class);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.firstOrNull()).thenReturn(doc);
        when(doc.get("holder", String.class)).thenReturn("instance-other");

        assertThat(store.acquireMigrationLock("instance-a"), is(false));

        verify(mockCollection, never()).update(any(Document.class));
        verify(mockCollection, never()).insert(any(Document.class));
    }

    @Test
    void release_the_lock_when_held_by_the_given_instance() {
        Document doc = mock(Document.class);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.firstOrNull()).thenReturn(doc);
        when(doc.get("holder", String.class)).thenReturn("instance-a");

        store.releaseMigrationLock("instance-a");

        verify(doc).put("holder", null);
        verify(doc).put("acquiredAt", null);
        verify(mockCollection).update(doc);
    }

    @Test
    void not_release_the_lock_when_held_by_a_different_instance() {
        Document doc = mock(Document.class);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.firstOrNull()).thenReturn(doc);
        when(doc.get("holder", String.class)).thenReturn("instance-other");

        store.releaseMigrationLock("instance-a");

        verify(mockCollection, never()).update(any(Document.class));
    }

    @Test
    void not_release_the_lock_when_no_lock_document_exists() {
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.firstOrNull()).thenReturn(null);

        store.releaseMigrationLock("instance-a");

        verify(mockCollection, never()).update(any(Document.class));
    }

    @Test
    void report_the_lock_as_not_held_when_no_lock_document_exists() {
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.firstOrNull()).thenReturn(null);

        assertThat(store.isMigrationLockHeld(), is(false));
    }

    @Test
    void report_the_lock_as_not_held_when_the_lock_document_has_no_holder() {
        Document doc = mock(Document.class);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.firstOrNull()).thenReturn(doc);
        when(doc.get("holder", String.class)).thenReturn(null);

        assertThat(store.isMigrationLockHeld(), is(false));
    }

    @Test
    void report_the_lock_as_held_when_the_lock_document_has_a_holder() {
        Document doc = mock(Document.class);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.firstOrNull()).thenReturn(doc);
        when(doc.get("holder", String.class)).thenReturn("instance-a");

        assertThat(store.isMigrationLockHeld(), is(true));
    }
}
