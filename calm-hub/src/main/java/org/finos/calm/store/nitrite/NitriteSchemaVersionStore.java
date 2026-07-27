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
import org.finos.calm.store.SchemaVersionStore;

import java.time.Instant;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

import static org.dizitart.no2.filters.FluentFilter.where;

/**
 * NitriteDB-backed implementation of {@link SchemaVersionStore}, used in
 * standalone mode.
 *
 * <p>Stores two documents, each identified by a fixed {@code documentId}
 * field value, in the {@code calm} collection: {@code schemaVersion} (the
 * version marker) and {@code migrationLock} (the cross-instance lock).
 * Neither document exists until first written — {@link #getSchemaVersion()}
 * treats an absent document as version {@code 0}. A {@link ReentrantLock}
 * guards each find-then-write, consistent with {@link NitriteCounterStore}'s
 * pattern for single-document collections in this embedded, in-process
 * store — the lock document itself is mostly a formality here, since
 * NitriteDB's underlying MVStore file lock already prevents a second process
 * from opening the same database for writing.</p>
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "standalone")
@ApplicationScoped
@Typed(NitriteSchemaVersionStore.class)
public class NitriteSchemaVersionStore implements SchemaVersionStore {

    private static final String COLLECTION_NAME = "calm";
    private static final String DOCUMENT_ID_FIELD = "documentId";
    private static final String VERSION_DOCUMENT_ID = "schemaVersion";
    private static final String VERSION_FIELD = "version";

    private static final String LOCK_DOCUMENT_ID = "migrationLock";
    private static final String HOLDER_FIELD = "holder";
    private static final String ACQUIRED_AT_FIELD = "acquiredAt";

    private final Lock lock = new ReentrantLock();
    private final NitriteCollection calmCollection;

    @Inject
    public NitriteSchemaVersionStore(@StandaloneQualifier Nitrite db) {
        this.calmCollection = db.getCollection(COLLECTION_NAME);
    }

    @Override
    public int getSchemaVersion() {
        lock.lock();
        try {
            Document doc = findDocument(VERSION_DOCUMENT_ID);
            if (doc == null) {
                return 0;
            }
            Integer version = doc.get(VERSION_FIELD, Integer.class);
            return version == null ? 0 : version;
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void setSchemaVersion(int version) {
        lock.lock();
        try {
            Document doc = findDocument(VERSION_DOCUMENT_ID);
            if (doc == null) {
                calmCollection.insert(Document.createDocument()
                        .put(DOCUMENT_ID_FIELD, VERSION_DOCUMENT_ID)
                        .put(VERSION_FIELD, version));
            } else {
                doc.put(VERSION_FIELD, version);
                calmCollection.update(doc);
            }
        } finally {
            lock.unlock();
        }
    }

    @Override
    public boolean acquireMigrationLock(String instanceId) {
        lock.lock();
        try {
            Document doc = findDocument(LOCK_DOCUMENT_ID);
            if (doc != null) {
                String holder = doc.get(HOLDER_FIELD, String.class);
                if (holder != null) {
                    return false;
                }
                doc.put(HOLDER_FIELD, instanceId);
                doc.put(ACQUIRED_AT_FIELD, Instant.now().toEpochMilli());
                calmCollection.update(doc);
            } else {
                calmCollection.insert(Document.createDocument()
                        .put(DOCUMENT_ID_FIELD, LOCK_DOCUMENT_ID)
                        .put(HOLDER_FIELD, instanceId)
                        .put(ACQUIRED_AT_FIELD, Instant.now().toEpochMilli()));
            }
            return true;
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void releaseMigrationLock(String instanceId) {
        lock.lock();
        try {
            Document doc = findDocument(LOCK_DOCUMENT_ID);
            if (doc != null && instanceId.equals(doc.get(HOLDER_FIELD, String.class))) {
                doc.put(HOLDER_FIELD, null);
                calmCollection.update(doc);
            }
        } finally {
            lock.unlock();
        }
    }

    @Override
    public boolean isMigrationLockHeld() {
        lock.lock();
        try {
            Document doc = findDocument(LOCK_DOCUMENT_ID);
            return doc != null && doc.get(HOLDER_FIELD, String.class) != null;
        } finally {
            lock.unlock();
        }
    }

    private Document findDocument(String documentId) {
        Filter filter = where(DOCUMENT_ID_FIELD).eq(documentId);
        return calmCollection.find(filter).firstOrNull();
    }
}
