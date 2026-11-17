package org.finos.calm.store.mongo;

import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import org.bson.Document;
import org.finos.calm.domain.audit.AuditAction;
import org.finos.calm.domain.audit.AuditEntityType;
import org.finos.calm.domain.audit.AuditLogEntry;
import org.finos.calm.domain.audit.AuditLogQuery;
import org.finos.calm.domain.audit.AuditOutcome;
import org.finos.calm.store.AuditLogStore;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

/**
 * MongoDB-backed implementation of {@link AuditLogStore}.
 *
 * <p>Every record is an independent insert with no uniqueness invariant to protect,
 * so — unlike most other Mongo stores in this codebase — no duplicate-key handling
 * or upsert logic is needed here.</p>
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "mongo", lookupIfMissing = true)
@ApplicationScoped
@Typed(MongoAuditLogStore.class)
public class MongoAuditLogStore implements AuditLogStore {

    private final MongoCollection<Document> auditLogCollection;

    public MongoAuditLogStore(MongoDatabase database) {
        this.auditLogCollection = database.getCollection("auditLogs");
    }

    @Override
    public void record(AuditLogEntry entry) {
        auditLogCollection.insertOne(toDocument(entry));
    }

    @Override
    public List<AuditLogEntry> query(AuditLogQuery query) {
        Document filter = toFilter(query);
        FindIterable<Document> results = auditLogCollection.find(filter).sort(new Document("timestamp", -1));
        if (query.getOffset() != null) {
            results = results.skip(Math.max(0, query.getOffset()));
        }
        if (query.getLimit() != null) {
            results = results.limit(Math.max(0, query.getLimit()));
        }
        List<AuditLogEntry> entries = new ArrayList<>();
        for (Document doc : results) {
            entries.add(toEntry(doc));
        }
        return entries;
    }

    private Document toFilter(AuditLogQuery query) {
        Document filter = new Document();
        if (query.getNamespace() != null) {
            filter.append("namespace", query.getNamespace());
        }
        if (query.getDomain() != null) {
            filter.append("domain", query.getDomain());
        }
        if (query.getEntityType() != null) {
            filter.append("entityType", query.getEntityType().name());
        }
        if (query.getEntityId() != null) {
            filter.append("entityId", query.getEntityId());
        }
        if (query.getActor() != null) {
            filter.append("actor", query.getActor());
        }
        if (query.getFrom() != null || query.getTo() != null) {
            Document range = new Document();
            if (query.getFrom() != null) {
                range.append("$gte", toDate(query.getFrom()));
            }
            if (query.getTo() != null) {
                range.append("$lte", toDate(query.getTo()));
            }
            filter.append("timestamp", range);
        }
        return filter;
    }

    private Document toDocument(AuditLogEntry entry) {
        Document document = new Document("timestamp", toDate(entry.getTimestamp()))
                .append("actor", entry.getActor())
                .append("action", nameOrNull(entry.getAction()))
                .append("entityType", nameOrNull(entry.getEntityType()))
                .append("namespace", entry.getNamespace())
                .append("domain", entry.getDomain())
                .append("entityId", entry.getEntityId())
                .append("version", entry.getVersion())
                .append("outcome", nameOrNull(entry.getOutcome()))
                .append("sourceIp", entry.getSourceIp());
        // Only extension entries have these, so that other entries keep their shape.
        appendIfPresent(document, "route", entry.getRoute());
        appendIfPresent(document, "jti", entry.getJti());
        return document;
    }

    private static void appendIfPresent(Document document, String key, String value) {
        if (value != null) {
            document.append(key, value);
        }
    }

    private AuditLogEntry toEntry(Document doc) {
        AuditLogEntry entry = new AuditLogEntry();
        Date timestamp = doc.getDate("timestamp");
        entry.setTimestamp(timestamp == null ? null : LocalDateTime.ofInstant(timestamp.toInstant(), ZoneOffset.UTC));
        entry.setActor(doc.getString("actor"));
        String action = doc.getString("action");
        entry.setAction(action == null ? null : AuditAction.valueOf(action));
        String entityType = doc.getString("entityType");
        entry.setEntityType(entityType == null ? null : AuditEntityType.valueOf(entityType));
        entry.setNamespace(doc.getString("namespace"));
        entry.setDomain(doc.getString("domain"));
        entry.setEntityId(doc.getString("entityId"));
        entry.setVersion(doc.getString("version"));
        String outcome = doc.getString("outcome");
        entry.setOutcome(outcome == null ? null : AuditOutcome.valueOf(outcome));
        entry.setSourceIp(doc.getString("sourceIp"));
        entry.setRoute(doc.getString("route"));
        entry.setJti(doc.getString("jti"));
        return entry;
    }

    private static Date toDate(LocalDateTime timestamp) {
        return timestamp == null ? null : Date.from(timestamp.toInstant(ZoneOffset.UTC));
    }

    private static String nameOrNull(Enum<?> value) {
        return value == null ? null : value.name();
    }
}
