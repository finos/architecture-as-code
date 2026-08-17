package org.finos.calm.store.mongo;

import com.mongodb.client.MongoDatabase;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import org.bson.Document;
import org.finos.calm.domain.timeline.Timeline;
import org.finos.calm.domain.exception.TimelineNotFoundException;
import org.finos.calm.domain.exception.TimelineVersionExistsException;
import org.finos.calm.domain.exception.TimelineVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.timeline.CreateTimelineRequest;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.domain.timeline.NamespaceTimelineSummary;
import org.finos.calm.store.TimelineStore;
import org.finos.calm.store.PageRequest;
import org.finos.calm.store.util.MongoVersionDocumentStore;

import java.util.List;

import io.quarkus.arc.lookup.LookupIfProperty;

import static org.finos.calm.store.util.MongoVersionDocumentStore.INITIAL_VERSION;

/**
 * MongoDB-backed implementation of {@link TimelineStore}.
 *
 * <h2>Document model</h2>
 * One <em>header</em> document per timeline in {@code timelines}, and one <em>version</em> document
 * per version in {@code timelineVersions}. All document handling lives in
 * {@link MongoVersionDocumentStore}; this class only translates between that and the
 * domain's objects and exceptions. See
 * {@code calm-hub/decisions/0001-versioned-artefact-storage.md}.
 *
 * <p>Like Pattern and unlike Architecture, version writes update the header's name and
 * description only when they are non-blank — Timeline's old shape guarded those fields.</p>
 *
 * <p>{@link TimelineStore} exposes no paged listing, so summaries are always fetched
 * {@link PageRequest#UNPAGED}. The helper supports paging whenever the interface grows one.</p>
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "mongo", lookupIfMissing = true)
@ApplicationScoped
@Typed(MongoTimelineStore.class)
public class MongoTimelineStore implements TimelineStore {

    private static final String HEADER_COLLECTION = "timelines";
    private static final String VERSION_COLLECTION = "timelineVersions";
    private static final String ID_FIELD = "timelineId";
    private static final String RESOURCE_LABEL = "Timeline";

    private final MongoCounterStore counterStore;
    private final MongoNamespaceStore namespaceStore;
    private final MongoVersionDocumentStore documentStore;

    public MongoTimelineStore(MongoDatabase database, MongoCounterStore counterStore, MongoNamespaceStore namespaceStore) {
        this.counterStore = counterStore;
        this.namespaceStore = namespaceStore;
        this.documentStore = new MongoVersionDocumentStore(
                database.getCollection(HEADER_COLLECTION),
                database.getCollection(VERSION_COLLECTION),
                ID_FIELD,
                RESOURCE_LABEL);
    }

    @Override
    public List<NamespaceTimelineSummary> getTimelinesForNamespace(String namespace) throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);
        return documentStore.listSummariesPaged(namespace, PageRequest.UNPAGED).stream()
                .map(MongoTimelineStore::toTimelineSummary)
                .toList();
    }

    /** Drops the version count, which {@link NamespaceTimelineSummary} does not carry. */
    private static NamespaceTimelineSummary toTimelineSummary(NamespaceResourceSummary summary) {
        return new NamespaceTimelineSummary(summary.getName(), summary.getDescription(), summary.getId());
    }

    @Override
    public Timeline createTimelineForNamespace(CreateTimelineRequest timelineRequest, String namespace) throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);

        // Parsed before the counter is drawn and before anything is written, so malformed
        // JSON can't leave a header behind with no version to go with it.
        Document content = Document.parse(timelineRequest.getTimelineJson());

        int id = counterStore.getNextTimelineSequenceValue();
        documentStore.createHeader(namespace, id, timelineRequest.getName(), timelineRequest.getDescription());
        documentStore.createFirstVersion(namespace, id, content);

        return new Timeline.TimelineBuilder()
                .setId(id)
                .setVersion(INITIAL_VERSION)
                .setNamespace(namespace)
                .setTimeline(timelineRequest.getTimelineJson())
                .build();
    }

    @Override
    public List<String> getTimelineVersions(Timeline timeline) throws NamespaceNotFoundException, TimelineNotFoundException {
        requireTimeline(timeline);
        return documentStore.listVersions(timeline.getNamespace(), timeline.getId());
    }

    @Override
    public String getTimelineForVersion(Timeline timeline) throws NamespaceNotFoundException, TimelineNotFoundException, TimelineVersionNotFoundException {
        requireTimeline(timeline);

        Document content = documentStore.getVersion(timeline.getNamespace(), timeline.getId(), timeline.getDotVersion());
        if (content == null) {
            throw new TimelineVersionNotFoundException();
        }
        return content.toJson();
    }

    @Override
    public Timeline createTimelineForVersion(Timeline timeline) throws NamespaceNotFoundException, TimelineNotFoundException, TimelineVersionExistsException {
        requireTimeline(timeline);

        Document content = Document.parse(timeline.getTimelineJson());
        if (!documentStore.createVersion(timeline.getNamespace(), timeline.getId(), timeline.getDotVersion(), content)) {
            throw new TimelineVersionExistsException();
        }

        updateHeaderDetails(timeline);
        return timeline;
    }

    @Override
    public Timeline updateTimelineForVersion(Timeline timeline) throws NamespaceNotFoundException, TimelineNotFoundException {
        requireTimeline(timeline);

        Document content = Document.parse(timeline.getTimelineJson());
        documentStore.upsertVersion(timeline.getNamespace(), timeline.getId(), timeline.getDotVersion(), content);

        updateHeaderDetails(timeline);
        return timeline;
    }

    /**
     * Applies the name and description that came with a version write, ignoring either that
     * is blank, and only after the version write succeeds.
     */
    private void updateHeaderDetails(Timeline timeline) {
        documentStore.updatePresentHeaderDetails(timeline.getNamespace(), timeline.getId(),
                timeline.getName(), timeline.getDescription());
    }

    private void requireTimeline(Timeline timeline) throws NamespaceNotFoundException, TimelineNotFoundException {
        namespaceStore.requireNamespace(timeline.getNamespace());
        if (!documentStore.headerExists(timeline.getNamespace(), timeline.getId())) {
            throw new TimelineNotFoundException();
        }
    }
}
