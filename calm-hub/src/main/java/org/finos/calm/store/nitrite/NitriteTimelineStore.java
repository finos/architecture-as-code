package org.finos.calm.store.nitrite;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.bson.json.JsonParseException;
import org.dizitart.no2.Nitrite;
import org.finos.calm.config.StandaloneQualifier;
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
import org.finos.calm.store.util.NitriteVersionDocumentStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

import io.quarkus.arc.lookup.LookupIfProperty;

import static org.finos.calm.store.util.NitriteVersionDocumentStore.INITIAL_VERSION;

/**
 * NitriteDB-backed implementation of {@link TimelineStore}, used in standalone mode.
 *
 * <h2>Document model</h2>
 * One <em>header</em> document per timeline in {@code timelines}, and one <em>version</em> document
 * per version in {@code timelineVersions}, mirroring {@link org.finos.calm.store.mongo.MongoTimelineStore}.
 * All document handling and locking live in {@link NitriteVersionDocumentStore}.
 *
 * <p>As with the other Nitrite stores, content is held as a JSON string rather than a parsed
 * document, and JSON is validated up front — before the timeline's existence is checked, where
 * Mongo reports the missing timeline first.</p>
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "standalone")
@ApplicationScoped
@Typed(NitriteTimelineStore.class)
public class NitriteTimelineStore implements TimelineStore {

    private static final Logger LOG = LoggerFactory.getLogger(NitriteTimelineStore.class);
    private static final String HEADER_COLLECTION = "timelines";
    private static final String VERSION_COLLECTION = "timelineVersions";
    private static final String ID_FIELD = "timelineId";
    private static final String RESOURCE_LABEL = "Timeline";

    private final NitriteNamespaceStore namespaceStore;
    private final NitriteCounterStore counterStore;
    private final NitriteVersionDocumentStore documentStore;

    @Inject
    public NitriteTimelineStore(@StandaloneQualifier Nitrite db, NitriteNamespaceStore namespaceStore, NitriteCounterStore counterStore) {
        this.namespaceStore = namespaceStore;
        this.counterStore = counterStore;
        this.documentStore = new NitriteVersionDocumentStore(
                db.getCollection(HEADER_COLLECTION),
                db.getCollection(VERSION_COLLECTION),
                ID_FIELD,
                RESOURCE_LABEL);
        LOG.info("NitriteTimelineStore initialized with collections: {} / {}", HEADER_COLLECTION, VERSION_COLLECTION);
    }

    @Override
    public List<NamespaceTimelineSummary> getTimelinesForNamespace(String namespace) throws NamespaceNotFoundException {
        requireNamespace(namespace);
        return documentStore.listSummariesPaged(namespace, PageRequest.UNPAGED).stream()
                .map(NitriteTimelineStore::toTimelineSummary)
                .toList();
    }

    /** Drops the version count, which {@link NamespaceTimelineSummary} does not carry. */
    private static NamespaceTimelineSummary toTimelineSummary(NamespaceResourceSummary summary) {
        return new NamespaceTimelineSummary(summary.getName(), summary.getDescription(), summary.getId());
    }

    @Override
    public Timeline createTimelineForNamespace(CreateTimelineRequest timelineRequest, String namespace) throws NamespaceNotFoundException {
        requireNamespace(namespace);
        validateTimelineJson(timelineRequest.getTimelineJson());

        int id = counterStore.getNextTimelineSequenceValue();
        documentStore.createHeader(namespace, id, timelineRequest.getName(), timelineRequest.getDescription());
        documentStore.createFirstVersion(namespace, id, timelineRequest.getTimelineJson());

        LOG.info("Created timeline with ID {} for namespace '{}'", id, namespace);
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

        String content = documentStore.getVersion(timeline.getNamespace(), timeline.getId(), timeline.getDotVersion());
        if (content == null) {
            LOG.warn("Version '{}' not found for timeline {} in namespace '{}'",
                    timeline.getDotVersion(), timeline.getId(), timeline.getNamespace());
            throw new TimelineVersionNotFoundException();
        }
        return content;
    }

    @Override
    public Timeline createTimelineForVersion(Timeline timeline) throws NamespaceNotFoundException, TimelineNotFoundException, TimelineVersionExistsException {
        requireNamespace(timeline.getNamespace());
        validateTimelineJson(timeline.getTimelineJson());
        requireTimelineExists(timeline);

        if (!documentStore.createVersion(timeline.getNamespace(), timeline.getId(), timeline.getDotVersion(), timeline.getTimelineJson())) {
            LOG.warn("Version '{}' already exists for timeline {} in namespace '{}'",
                    timeline.getDotVersion(), timeline.getId(), timeline.getNamespace());
            throw new TimelineVersionExistsException();
        }

        updateHeaderDetails(timeline);
        return timeline;
    }

    @Override
    public Timeline updateTimelineForVersion(Timeline timeline) throws NamespaceNotFoundException, TimelineNotFoundException {
        requireNamespace(timeline.getNamespace());
        validateTimelineJson(timeline.getTimelineJson());
        requireTimelineExists(timeline);

        documentStore.upsertVersion(timeline.getNamespace(), timeline.getId(), timeline.getDotVersion(), timeline.getTimelineJson());

        updateHeaderDetails(timeline);
        return timeline;
    }

    /**
     * Validates that the supplied timeline JSON is parseable, throwing {@link JsonParseException}
     * if not so the REST layer can surface a 400.
     */
    private void validateTimelineJson(String timelineJson) {
        if (timelineJson == null) {
            LOG.error("Timeline JSON must not be null");
            throw new JsonParseException("Timeline JSON must not be null");
        }
        try {
            // Use org.bson.Document to validate JSON
            org.bson.Document.parse(timelineJson);
        } catch (JsonParseException e) {
            // Rethrow the original so the parse failure's stack trace is preserved for
            // observability. Flow, Standard and Interface wrap instead — that is a real
            // pre-existing difference between the types, not an inconsistency to tidy, and
            // this port exists to preserve each one's behaviour rather than pick a winner.
            LOG.error("Invalid JSON format for timeline: {}", e.getMessage());
            throw e;
        }
    }


    private void updateHeaderDetails(Timeline timeline) {
        documentStore.updatePresentHeaderDetails(timeline.getNamespace(), timeline.getId(),
                timeline.getName(), timeline.getDescription());
    }

    private void requireNamespace(String namespace) throws NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            LOG.warn("Namespace '{}' not found", namespace);
            throw new NamespaceNotFoundException();
        }
    }

    private void requireTimelineExists(Timeline timeline) throws TimelineNotFoundException {
        if (!documentStore.headerExists(timeline.getNamespace(), timeline.getId())) {
            LOG.warn("Timeline with ID {} not found in namespace '{}'", timeline.getId(), timeline.getNamespace());
            throw new TimelineNotFoundException();
        }
    }

    private void requireTimeline(Timeline timeline) throws NamespaceNotFoundException, TimelineNotFoundException {
        requireNamespace(timeline.getNamespace());
        requireTimelineExists(timeline);
    }
}
