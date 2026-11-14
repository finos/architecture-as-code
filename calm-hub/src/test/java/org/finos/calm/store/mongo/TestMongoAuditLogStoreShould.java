package org.finos.calm.store.mongo;

import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoCursor;
import com.mongodb.client.MongoDatabase;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.bson.Document;
import org.finos.calm.domain.audit.AuditAction;
import org.finos.calm.domain.audit.AuditEntityType;
import org.finos.calm.domain.audit.AuditLogEntry;
import org.finos.calm.domain.audit.AuditLogQuery;
import org.finos.calm.domain.audit.AuditOutcome;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Date;
import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@QuarkusTest
public class TestMongoAuditLogStoreShould {

    @InjectMock
    MongoDatabase mongoDatabase;

    private MongoCollection<Document> auditLogCollection;
    private MongoAuditLogStore store;

    @BeforeEach
    void setup() {
        auditLogCollection = Mockito.mock(DocumentMongoCollection.class);
        when(mongoDatabase.getCollection("auditLogs")).thenReturn(auditLogCollection);
        store = new MongoAuditLogStore(mongoDatabase);
    }

    @Test
    void insert_a_document_with_all_fields_on_record() {
        LocalDateTime timestamp = LocalDateTime.of(2026, 1, 1, 10, 30);
        AuditLogEntry entry = new AuditLogEntry.AuditLogEntryBuilder()
                .setTimestamp(timestamp)
                .setActor("alice")
                .setAction(AuditAction.CREATE)
                .setEntityType(AuditEntityType.ARCHITECTURE)
                .setNamespace("finos")
                .setEntityId("2")
                .setVersion("1.0.0")
                .setOutcome(AuditOutcome.SUCCESS)
                .setSourceIp("10.0.0.1")
                .build();

        store.record(entry);

        Document expected = new Document("timestamp", Date.from(timestamp.toInstant(ZoneOffset.UTC)))
                .append("actor", "alice")
                .append("action", "CREATE")
                .append("entityType", "ARCHITECTURE")
                .append("namespace", "finos")
                .append("domain", null)
                .append("entityId", "2")
                .append("version", "1.0.0")
                .append("outcome", "SUCCESS")
                .append("sourceIp", "10.0.0.1");

        verify(auditLogCollection).insertOne(expected);
    }

    @Test
    void store_and_read_back_the_route_and_jti_of_an_extension_entry() {
        LocalDateTime timestamp = LocalDateTime.of(2026, 1, 1, 10, 30);
        AuditLogEntry entry = new AuditLogEntry.AuditLogEntryBuilder()
                .setTimestamp(timestamp)
                .setActor("alice")
                .setAction(AuditAction.CREATE)
                .setEntityType(AuditEntityType.EXTENSION)
                .setNamespace("finos")
                .setEntityId("team-services")
                .setOutcome(AuditOutcome.SUCCESS)
                .setRoute("add-service")
                .setJti("jti-1")
                .build();

        store.record(entry);

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(auditLogCollection).insertOne(captor.capture());
        assertThat(captor.getValue().getString("route"), is("add-service"));
        assertThat(captor.getValue().getString("jti"), is("jti-1"));

        DocumentFindIterable findIterable = Mockito.mock(DocumentFindIterable.class);
        DocumentMongoCursor cursor = Mockito.mock(DocumentMongoCursor.class);
        when(cursor.hasNext()).thenReturn(true, false);
        when(cursor.next()).thenReturn(captor.getValue());
        when(findIterable.iterator()).thenReturn(cursor);
        when(findIterable.sort(any(Document.class))).thenReturn(findIterable);
        when(auditLogCollection.find(any(Document.class))).thenReturn(findIterable);

        assertThat(store.query(new AuditLogQuery()).get(0), is(entry));
    }

    @Test
    void return_empty_list_when_no_entries_match_query() {
        DocumentFindIterable findIterable = Mockito.mock(DocumentFindIterable.class);
        DocumentMongoCursor cursor = Mockito.mock(DocumentMongoCursor.class);
        when(cursor.hasNext()).thenReturn(false);
        when(findIterable.iterator()).thenReturn(cursor);
        when(findIterable.sort(any(Document.class))).thenReturn(findIterable);
        when(auditLogCollection.find(any(Document.class))).thenReturn(findIterable);

        List<AuditLogEntry> result = store.query(new AuditLogQuery());

        assertThat(result, is(empty()));
    }

    @Test
    void build_filter_from_populated_query_fields_only() {
        DocumentFindIterable findIterable = Mockito.mock(DocumentFindIterable.class);
        DocumentMongoCursor cursor = Mockito.mock(DocumentMongoCursor.class);
        when(cursor.hasNext()).thenReturn(false);
        when(findIterable.iterator()).thenReturn(cursor);
        when(findIterable.sort(any(Document.class))).thenReturn(findIterable);
        when(auditLogCollection.find(any(Document.class))).thenReturn(findIterable);

        AuditLogQuery query = new AuditLogQuery();
        query.setNamespace("finos");
        query.setEntityType(AuditEntityType.ARCHITECTURE);
        query.setEntityId("2");

        store.query(query);

        Document expectedFilter = new Document("namespace", "finos")
                .append("entityType", "ARCHITECTURE")
                .append("entityId", "2");
        verify(auditLogCollection).find(expectedFilter);
    }

    @Test
    void build_filter_with_domain_actor_and_date_range() {
        DocumentFindIterable findIterable = Mockito.mock(DocumentFindIterable.class);
        DocumentMongoCursor cursor = Mockito.mock(DocumentMongoCursor.class);
        when(cursor.hasNext()).thenReturn(false);
        when(findIterable.iterator()).thenReturn(cursor);
        when(findIterable.sort(any(Document.class))).thenReturn(findIterable);
        when(auditLogCollection.find(any(Document.class))).thenReturn(findIterable);

        LocalDateTime from = LocalDateTime.of(2026, 1, 1, 0, 0);
        LocalDateTime to = LocalDateTime.of(2026, 1, 31, 0, 0);
        AuditLogQuery query = new AuditLogQuery();
        query.setDomain("payments");
        query.setActor("alice");
        query.setFrom(from);
        query.setTo(to);

        store.query(query);

        Document expectedFilter = new Document("domain", "payments")
                .append("actor", "alice")
                .append("timestamp", new Document("$gte", Date.from(from.toInstant(ZoneOffset.UTC)))
                        .append("$lte", Date.from(to.toInstant(ZoneOffset.UTC))));
        verify(auditLogCollection).find(expectedFilter);
    }

    @Test
    void apply_limit_and_offset_when_present() {
        DocumentFindIterable findIterable = Mockito.mock(DocumentFindIterable.class);
        DocumentMongoCursor cursor = Mockito.mock(DocumentMongoCursor.class);
        when(cursor.hasNext()).thenReturn(false);
        when(findIterable.iterator()).thenReturn(cursor);
        when(findIterable.sort(any(Document.class))).thenReturn(findIterable);
        when(findIterable.skip(5)).thenReturn(findIterable);
        when(findIterable.limit(10)).thenReturn(findIterable);
        when(auditLogCollection.find(any(Document.class))).thenReturn(findIterable);

        AuditLogQuery query = new AuditLogQuery();
        query.setOffset(5);
        query.setLimit(10);

        store.query(query);

        verify(findIterable).skip(5);
        verify(findIterable).limit(10);
    }

    @Test
    void clamp_a_negative_offset_to_zero_instead_of_passing_it_to_mongo() {
        DocumentFindIterable findIterable = Mockito.mock(DocumentFindIterable.class);
        DocumentMongoCursor cursor = Mockito.mock(DocumentMongoCursor.class);
        when(cursor.hasNext()).thenReturn(false);
        when(findIterable.iterator()).thenReturn(cursor);
        when(findIterable.sort(any(Document.class))).thenReturn(findIterable);
        when(findIterable.skip(0)).thenReturn(findIterable);
        when(auditLogCollection.find(any(Document.class))).thenReturn(findIterable);

        AuditLogQuery query = new AuditLogQuery();
        query.setOffset(-1);

        store.query(query);

        verify(findIterable).skip(0);
    }

    @Test
    void clamp_a_negative_limit_to_zero_instead_of_passing_it_to_mongo() {
        DocumentFindIterable findIterable = Mockito.mock(DocumentFindIterable.class);
        DocumentMongoCursor cursor = Mockito.mock(DocumentMongoCursor.class);
        when(cursor.hasNext()).thenReturn(false);
        when(findIterable.iterator()).thenReturn(cursor);
        when(findIterable.sort(any(Document.class))).thenReturn(findIterable);
        when(findIterable.limit(0)).thenReturn(findIterable);
        when(auditLogCollection.find(any(Document.class))).thenReturn(findIterable);

        AuditLogQuery query = new AuditLogQuery();
        query.setLimit(-1);

        store.query(query);

        verify(findIterable).limit(0);
    }

    @Test
    void map_documents_back_to_entries_preserving_all_fields() {
        LocalDateTime timestamp = LocalDateTime.of(2026, 1, 1, 10, 30);
        Document doc = new Document("timestamp", Date.from(timestamp.toInstant(ZoneOffset.UTC)))
                .append("actor", "alice")
                .append("action", "CREATE")
                .append("entityType", "ARCHITECTURE")
                .append("namespace", "finos")
                .append("entityId", "2")
                .append("version", "1.0.0")
                .append("outcome", "SUCCESS")
                .append("sourceIp", "10.0.0.1");

        DocumentFindIterable findIterable = Mockito.mock(DocumentFindIterable.class);
        DocumentMongoCursor cursor = Mockito.mock(DocumentMongoCursor.class);
        when(cursor.hasNext()).thenReturn(true, false);
        when(cursor.next()).thenReturn(doc);
        when(findIterable.iterator()).thenReturn(cursor);
        when(findIterable.sort(any(Document.class))).thenReturn(findIterable);
        when(auditLogCollection.find(any(Document.class))).thenReturn(findIterable);

        List<AuditLogEntry> result = store.query(new AuditLogQuery());

        assertThat(result, hasSize(1));
        AuditLogEntry entry = result.get(0);
        assertThat(entry.getActor(), is("alice"));
        assertThat(entry.getAction(), is(AuditAction.CREATE));
        assertThat(entry.getEntityType(), is(AuditEntityType.ARCHITECTURE));
        assertThat(entry.getNamespace(), is("finos"));
        assertThat(entry.getEntityId(), is("2"));
        assertThat(entry.getVersion(), is("1.0.0"));
        assertThat(entry.getOutcome(), is(AuditOutcome.SUCCESS));
        assertThat(entry.getSourceIp(), is("10.0.0.1"));
        assertThat(entry.getTimestamp(), is(timestamp));
    }

    private interface DocumentFindIterable extends FindIterable<Document> {
    }

    private interface DocumentMongoCollection extends MongoCollection<Document> {
    }

    private interface DocumentMongoCursor extends MongoCursor<Document> {
    }
}
