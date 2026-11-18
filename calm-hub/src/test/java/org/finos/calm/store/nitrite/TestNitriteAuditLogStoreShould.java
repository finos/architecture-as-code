package org.finos.calm.store.nitrite;

import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.DocumentCursor;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.filters.Filter;
import org.finos.calm.domain.audit.AuditLogEntry;
import org.finos.calm.domain.audit.AuditLogQuery;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class TestNitriteAuditLogStoreShould {

    @Mock
    private Nitrite mockDb;

    @Mock
    private NitriteCollection mockCollection;

    private NitriteAuditLogStore store;

    @BeforeEach
    void setup() {
        when(mockDb.getCollection(anyString())).thenReturn(mockCollection);
        store = new NitriteAuditLogStore(mockDb);
    }

    @Test
    void insert_a_document_on_record() {
        AuditLogEntry entry = new AuditLogEntry.AuditLogEntryBuilder()
                .setTimestamp(LocalDateTime.of(2026, 1, 1, 10, 30))
                .setActor("alice")
                .build();

        store.record(entry);

        verify(mockCollection).insert(any(Document.class));
    }

    @Test
    void store_and_read_back_the_route_and_jti_of_an_extension_entry() {
        AuditLogEntry entry = new AuditLogEntry.AuditLogEntryBuilder()
                .setTimestamp(LocalDateTime.of(2026, 1, 1, 10, 30))
                .setActor("alice")
                .setRoute("add-service")
                .setJti("jti-1")
                .build();

        store.record(entry);

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(mockCollection).insert(captor.capture());
        assertThat(captor.getValue().get("route", String.class), is("add-service"));
        assertThat(captor.getValue().get("jti", String.class), is("jti-1"));

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.iterator()).thenReturn(List.of(captor.getValue()).iterator());
        when(mockCollection.find()).thenReturn(cursor);

        assertThat(store.query(new AuditLogQuery()).get(0), is(entry));
    }

    @Test
    void return_empty_list_when_no_entries_exist() {
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.iterator()).thenReturn(new ArrayList<Document>().iterator());
        when(mockCollection.find()).thenReturn(cursor);

        List<AuditLogEntry> result = store.query(new AuditLogQuery());

        assertThat(result, is(empty()));
    }

    @Test
    void map_documents_back_to_entries_sorted_by_timestamp_descending() {
        LocalDateTime older = LocalDateTime.of(2026, 1, 1, 10, 0);
        LocalDateTime newer = LocalDateTime.of(2026, 1, 2, 10, 0);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.iterator()).thenReturn(Arrays.asList(toDoc("alice", older), toDoc("bob", newer)).iterator());
        when(mockCollection.find()).thenReturn(cursor);

        List<AuditLogEntry> result = store.query(new AuditLogQuery());

        assertThat(result, hasSize(2));
        assertThat(result.get(0).getActor(), is("bob"));
        assertThat(result.get(1).getActor(), is("alice"));
    }

    @Test
    void apply_limit_and_offset() {
        LocalDateTime t1 = LocalDateTime.of(2026, 1, 1, 10, 0);
        LocalDateTime t2 = LocalDateTime.of(2026, 1, 2, 10, 0);
        LocalDateTime t3 = LocalDateTime.of(2026, 1, 3, 10, 0);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.iterator()).thenReturn(
                Arrays.asList(toDoc("a", t1), toDoc("b", t2), toDoc("c", t3)).iterator());
        when(mockCollection.find()).thenReturn(cursor);

        AuditLogQuery query = new AuditLogQuery();
        query.setOffset(1);
        query.setLimit(1);

        List<AuditLogEntry> result = store.query(query);

        assertThat(result, hasSize(1));
        // Descending order is c, b, a — offset 1 skips c, limit 1 takes b.
        assertThat(result.get(0).getActor(), is("b"));
    }

    @Test
    void return_empty_list_when_offset_exceeds_result_size() {
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.iterator()).thenReturn(List.of(toDoc("a", LocalDateTime.now())).iterator());
        when(mockCollection.find()).thenReturn(cursor);

        AuditLogQuery query = new AuditLogQuery();
        query.setOffset(5);

        assertThat(store.query(query), is(empty()));
    }

    @Test
    void clamp_a_negative_offset_to_zero_instead_of_throwing() {
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.iterator()).thenReturn(List.of(toDoc("a", LocalDateTime.now())).iterator());
        when(mockCollection.find()).thenReturn(cursor);

        AuditLogQuery query = new AuditLogQuery();
        query.setOffset(-1);

        assertThat(store.query(query), hasSize(1));
    }

    @Test
    void clamp_a_negative_limit_to_zero_instead_of_throwing() {
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.iterator()).thenReturn(List.of(toDoc("a", LocalDateTime.now())).iterator());
        when(mockCollection.find()).thenReturn(cursor);

        AuditLogQuery query = new AuditLogQuery();
        query.setLimit(-1);

        assertThat(store.query(query), is(empty()));
    }

    @Test
    void query_with_a_filter_when_criteria_present() {
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.iterator()).thenReturn(new ArrayList<Document>().iterator());
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        AuditLogQuery query = new AuditLogQuery();
        query.setNamespace("finos");

        store.query(query);

        verify(mockCollection).find(any(Filter.class));
        verify(mockCollection, never()).find();
    }

    private Document toDoc(String actor, LocalDateTime timestamp) {
        return Document.createDocument()
                .put("timestamp", timestamp.toInstant(ZoneOffset.UTC).toEpochMilli())
                .put("actor", actor)
                .put("action", "CREATE")
                .put("entityType", "ARCHITECTURE")
                .put("namespace", "finos")
                .put("entityId", "2")
                .put("version", "1.0.0")
                .put("outcome", "SUCCESS");
    }
}
