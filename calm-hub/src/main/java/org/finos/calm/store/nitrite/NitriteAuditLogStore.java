package org.finos.calm.store.nitrite;

import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.filters.Filter;
import org.finos.calm.config.StandaloneQualifier;
import org.finos.calm.domain.audit.AuditAction;
import org.finos.calm.domain.audit.AuditEntityType;
import org.finos.calm.domain.audit.AuditLogEntry;
import org.finos.calm.domain.audit.AuditLogQuery;
import org.finos.calm.domain.audit.AuditOutcome;
import org.finos.calm.store.AuditLogStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import static org.dizitart.no2.filters.FluentFilter.where;

/**
 * NitriteDB-backed implementation of {@link AuditLogStore}, used in standalone mode.
 *
 * <p>Unlike other Nitrite stores in this codebase (e.g. {@code NitriteNamespaceStore}),
 * no {@link java.util.concurrent.locks.ReentrantLock} is needed here: every audit record
 * is an independent insert with no check-then-act uniqueness invariant to protect.</p>
 *
 * <p>{@code timestamp} is stored as epoch-millis ({@code Long}) rather than a Nitrite
 * date/string representation, so range queries in {@link #query(AuditLogQuery)} are
 * simple, exact numeric comparisons.</p>
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "standalone")
@ApplicationScoped
@Typed(NitriteAuditLogStore.class)
public class NitriteAuditLogStore implements AuditLogStore {

    private static final Logger LOG = LoggerFactory.getLogger(NitriteAuditLogStore.class);
    private static final String COLLECTION_NAME = "auditLogs";

    private final NitriteCollection auditLogCollection;

    @Inject
    public NitriteAuditLogStore(@StandaloneQualifier Nitrite db) {
        this.auditLogCollection = db.getCollection(COLLECTION_NAME);
        LOG.info("NitriteAuditLogStore initialized with collection: {}", COLLECTION_NAME);
    }

    @Override
    public void record(AuditLogEntry entry) {
        auditLogCollection.insert(toDocument(entry));
    }

    @Override
    public List<AuditLogEntry> query(AuditLogQuery query) {
        Filter filter = toFilter(query);
        List<AuditLogEntry> entries = new ArrayList<>();
        for (Document doc : (filter == null ? auditLogCollection.find() : auditLogCollection.find(filter))) {
            entries.add(toEntry(doc));
        }
        entries.sort(Comparator.comparing(AuditLogEntry::getTimestamp,
                Comparator.nullsLast(Comparator.reverseOrder())));
        int offset = query.getOffset() == null ? 0 : Math.max(0, query.getOffset());
        if (offset >= entries.size()) {
            return List.of();
        }
        int end;
        if (query.getLimit() == null) {
            end = entries.size();
        } else {
            long safeLimit = Math.max(query.getLimit(), 0L);
            end = (int) Math.min(entries.size(), offset + safeLimit);
        }
        return entries.subList(offset, end);
    }

    private Filter toFilter(AuditLogQuery query) {
        Filter filter = null;
        filter = and(filter, query.getNamespace() == null ? null : where("namespace").eq(query.getNamespace()));
        filter = and(filter, query.getDomain() == null ? null : where("domain").eq(query.getDomain()));
        filter = and(filter, query.getEntityType() == null ? null : where("entityType").eq(query.getEntityType().name()));
        filter = and(filter, query.getEntityId() == null ? null : where("entityId").eq(query.getEntityId()));
        filter = and(filter, query.getActor() == null ? null : where("actor").eq(query.getActor()));
        if (query.getFrom() != null) {
            filter = and(filter, where("timestamp").gte(toEpochMilli(query.getFrom())));
        }
        if (query.getTo() != null) {
            filter = and(filter, where("timestamp").lte(toEpochMilli(query.getTo())));
        }
        return filter;
    }

    private static Filter and(Filter existing, Filter next) {
        if (next == null) {
            return existing;
        }
        return existing == null ? next : Filter.and(existing, next);
    }

    private Document toDocument(AuditLogEntry entry) {
        Document document = Document.createDocument()
                .put("timestamp", toEpochMilli(entry.getTimestamp()))
                .put("actor", entry.getActor())
                .put("action", nameOrNull(entry.getAction()))
                .put("entityType", nameOrNull(entry.getEntityType()))
                .put("namespace", entry.getNamespace())
                .put("domain", entry.getDomain())
                .put("entityId", entry.getEntityId())
                .put("version", entry.getVersion())
                .put("outcome", nameOrNull(entry.getOutcome()))
                .put("sourceIp", entry.getSourceIp());
        // Only extension entries have these, so that other entries keep their shape.
        if (entry.getRoute() != null) {
            document.put("route", entry.getRoute());
        }
        if (entry.getJti() != null) {
            document.put("jti", entry.getJti());
        }
        return document;
    }

    private AuditLogEntry toEntry(Document doc) {
        AuditLogEntry entry = new AuditLogEntry();
        Long timestamp = doc.get("timestamp", Long.class);
        entry.setTimestamp(timestamp == null ? null
                : LocalDateTime.ofInstant(Instant.ofEpochMilli(timestamp), ZoneOffset.UTC));
        entry.setActor(doc.get("actor", String.class));
        String action = doc.get("action", String.class);
        entry.setAction(action == null ? null : AuditAction.valueOf(action));
        String entityType = doc.get("entityType", String.class);
        entry.setEntityType(entityType == null ? null : AuditEntityType.valueOf(entityType));
        entry.setNamespace(doc.get("namespace", String.class));
        entry.setDomain(doc.get("domain", String.class));
        entry.setEntityId(doc.get("entityId", String.class));
        entry.setVersion(doc.get("version", String.class));
        String outcome = doc.get("outcome", String.class);
        entry.setOutcome(outcome == null ? null : AuditOutcome.valueOf(outcome));
        entry.setSourceIp(doc.get("sourceIp", String.class));
        entry.setRoute(doc.get("route", String.class));
        entry.setJti(doc.get("jti", String.class));
        return entry;
    }

    private static Long toEpochMilli(LocalDateTime timestamp) {
        return timestamp == null ? null : timestamp.toInstant(ZoneOffset.UTC).toEpochMilli();
    }

    private static String nameOrNull(Enum<?> value) {
        return value == null ? null : value.name();
    }
}
