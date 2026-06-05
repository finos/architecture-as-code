package org.finos.calm.store.nitrite;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.bson.json.JsonParseException;
import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.filters.Filter;
import org.finos.calm.config.StandaloneQualifier;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.TimelineNotFoundException;
import org.finos.calm.domain.exception.TimelineVersionExistsException;
import org.finos.calm.domain.exception.TimelineVersionNotFoundException;
import org.finos.calm.domain.timeline.CreateTimelineRequest;
import org.finos.calm.domain.timeline.NamespaceTimelineSummary;
import org.finos.calm.domain.timeline.Timeline;
import org.finos.calm.store.TimelineStore;
import org.finos.calm.store.util.TypeSafeNitriteDocument;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

import static org.dizitart.no2.filters.FluentFilter.where;

/**
 * Implementation of the TimelineStore interface using NitriteDB.
 * This implementation is used when the application is running in standalone mode.
 */
@ApplicationScoped
@Typed(NitriteTimelineStore.class)
public class NitriteTimelineStore implements TimelineStore {

    private static final Logger LOG = LoggerFactory.getLogger(NitriteTimelineStore.class);
    private static final String COLLECTION_NAME = "timelines";
    private static final String NAMESPACE_FIELD = "namespace";
    private static final String TIMELINES_FIELD = "timelines";
    private static final String TIMELINE_ID_FIELD = "timelineId";
    private static final String VERSIONS_FIELD = "versions";
    private static final String NAME_FIELD = "name";
    private static final String DESCRIPTION_FIELD = "description";

    private final NitriteCollection timelineCollection;
    private final NitriteNamespaceStore namespaceStore;
    private final NitriteCounterStore counterStore;
    private final Lock lock = new ReentrantLock();

    @Inject
    public NitriteTimelineStore(@StandaloneQualifier Nitrite db, NitriteNamespaceStore namespaceStore, NitriteCounterStore counterStore) {
        this.timelineCollection = db.getCollection(COLLECTION_NAME);
        this.namespaceStore = namespaceStore;
        this.counterStore = counterStore;
        LOG.info("NitriteTimelineStore initialized with collection: {}", COLLECTION_NAME);
    }

    @Override
    public List<NamespaceTimelineSummary> getTimelinesForNamespace(String namespace) throws NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            LOG.warn("Namespace '{}' not found when retrieving timelines", namespace);
            throw new NamespaceNotFoundException();
        }

        Filter filter = where(NAMESPACE_FIELD).eq(namespace);
        Document namespaceDoc = timelineCollection.find(filter).firstOrNull();

        if (namespaceDoc == null) {
            LOG.warn("No timelines found for namespace '{}'", namespace);
            return List.of();
        }

        List<Document> timelines = new TypeSafeNitriteDocument<>(namespaceDoc, Document.class).getList(TIMELINES_FIELD);
        if (timelines == null || timelines.isEmpty()) {
            return List.of();
        }

        List<NamespaceTimelineSummary> timelineSummaries = new ArrayList<>();
        for (Document timeline : timelines) {
            Integer timelineId = timeline.get(TIMELINE_ID_FIELD, Integer.class);
            String name = timeline.get(NAME_FIELD, String.class);
            String description = timeline.get(DESCRIPTION_FIELD, String.class);
            if (name == null) name = "Timeline " + timelineId;
            if (description == null) description = "";
            timelineSummaries.add(new NamespaceTimelineSummary(name, description, timelineId));
        }

        return timelineSummaries;
    }

    @Override
    public Timeline createTimelineForNamespace(CreateTimelineRequest timelineRequest, String namespace) throws NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            LOG.warn("Namespace '{}' not found when creating timeline", namespace);
            throw new NamespaceNotFoundException();
        }

        // Validate JSON
        try {
            // Use org.bson.Document to validate JSON
            org.bson.Document.parse(timelineRequest.getTimelineJson());
        } catch (Exception e) {
            LOG.error("Invalid JSON format for timeline: {}", e.getMessage());
            throw new JsonParseException(e.getMessage());
        }

        lock.lock();
        try {
            int id = counterStore.getNextTimelineSequenceValue();
            Document timelineDocument = Document.createDocument()
                    .put(TIMELINE_ID_FIELD, id)
                    .put(NAME_FIELD, timelineRequest.getName())
                    .put(DESCRIPTION_FIELD, timelineRequest.getDescription())
                    .put(VERSIONS_FIELD, Document.createDocument()
                            .put("1-0-0", timelineRequest.getTimelineJson()));

            Filter filter = where(NAMESPACE_FIELD).eq(namespace);
            Document namespaceDoc = timelineCollection.find(filter).firstOrNull();

            if (namespaceDoc == null) {
                // Create a new namespace document with the timeline
                namespaceDoc = Document.createDocument()
                        .put(NAMESPACE_FIELD, namespace)
                        .put(TIMELINES_FIELD, List.of(timelineDocument));
                timelineCollection.insert(namespaceDoc);
            } else {
                // Add the timeline to the existing namespace document
                List<Document> timelines = new TypeSafeNitriteDocument<>(namespaceDoc, Document.class).getList(TIMELINES_FIELD);
                if (timelines == null) {
                    timelines = new ArrayList<>();
                } else {
                    timelines = new ArrayList<>(timelines); // Make a mutable copy
                }
                timelines.add(timelineDocument);
                namespaceDoc.put(TIMELINES_FIELD, timelines);
                timelineCollection.update(filter, namespaceDoc);
            }

            LOG.info("Created timeline with ID {} for namespace '{}'", id, namespace);

            return new Timeline.TimelineBuilder()
                    .setId(id)
                    .setVersion("1.0.0")
                    .setNamespace(namespace)
                    .setTimeline(timelineRequest.getTimelineJson())
                    .build();
        } finally {
            lock.unlock();
        }
    }

    @Override
    public List<String> getTimelineVersions(Timeline timeline) throws NamespaceNotFoundException, TimelineNotFoundException {
        Document result = retrieveTimelineVersions(timeline);

        List<Document> timelines = new TypeSafeNitriteDocument<>(result, Document.class).getList(TIMELINES_FIELD);
        for (Document timelineDoc : timelines) {
            if (timeline.getId() == timelineDoc.get(TIMELINE_ID_FIELD, Integer.class)) {
                // Extract the versions map from the matching timeline
                Document versions = timelineDoc.get(VERSIONS_FIELD, Document.class);
                if (versions == null) {
                    throw new TimelineNotFoundException();
                }

                // Convert from Nitrite representation
                List<String> resourceVersions = new ArrayList<>();
                Set<String> versionKeys = versions.getFields();
                for (String versionKey : versionKeys) {
                    resourceVersions.add(versionKey.replace('-', '.'));
                }
                return resourceVersions;
            }
        }

        throw new TimelineNotFoundException();
    }

    private Document retrieveTimelineVersions(Timeline timeline) throws NamespaceNotFoundException, TimelineNotFoundException {
        if (!namespaceStore.namespaceExists(timeline.getNamespace())) {
            LOG.warn("Namespace '{}' not found when retrieving timeline versions", timeline.getNamespace());
            throw new NamespaceNotFoundException();
        }

        Filter filter = where(NAMESPACE_FIELD).eq(timeline.getNamespace());
        Document result = timelineCollection.find(filter).firstOrNull();

        if (result == null) {
            LOG.warn("No timelines found for namespace '{}'", timeline.getNamespace());
            throw new TimelineNotFoundException();
        }

        return result;
    }

    @Override
    public String getTimelineForVersion(Timeline timeline) throws NamespaceNotFoundException, TimelineNotFoundException, TimelineVersionNotFoundException {
        Document result = retrieveTimelineVersions(timeline);

        List<Document> timelines = new TypeSafeNitriteDocument<>(result, Document.class).getList(TIMELINES_FIELD);
        for (Document timelineDoc : timelines) {
            if (timeline.getId() == timelineDoc.get(TIMELINE_ID_FIELD, Integer.class)) {
                // Retrieve the versions map from the matching timeline
                Document versions = timelineDoc.get(VERSIONS_FIELD, Document.class);
                if (versions == null) {
                    throw new TimelineVersionNotFoundException();
                }

                // Return the timeline JSON blob for the specified version
                String mongoVersion = timeline.getMongoVersion();
                Object versionObj = versions.get(mongoVersion);
                LOG.info("VersionDoc: [{}], Mongo Version: [{}]", versions, mongoVersion);

                if (!(versionObj instanceof String)) {
                    LOG.warn("Version '{}' not found for timeline {} in namespace '{}'",
                            timeline.getDotVersion(), timeline.getId(), timeline.getNamespace());
                    throw new TimelineVersionNotFoundException();
                }

                return (String) versionObj;
            }
        }

        // Timelines is empty, no version to find
        LOG.warn("Timeline with ID {} not found in namespace '{}'", timeline.getId(), timeline.getNamespace());
        throw new TimelineVersionNotFoundException();
    }

    @Override
    public Timeline createTimelineForVersion(Timeline timeline) throws NamespaceNotFoundException, TimelineNotFoundException, TimelineVersionExistsException {
        if (!namespaceStore.namespaceExists(timeline.getNamespace())) {
            LOG.warn("Namespace '{}' not found when creating timeline version", timeline.getNamespace());
            throw new NamespaceNotFoundException();
        }

        lock.lock();
        try {
            if (versionExists(timeline)) {
                LOG.warn("Version '{}' already exists for timeline {} in namespace '{}'",
                        timeline.getDotVersion(), timeline.getId(), timeline.getNamespace());
                throw new TimelineVersionExistsException();
            }

            writeTimelineToNitrite(timeline);
        } finally {
            lock.unlock();
        }
        return timeline;
    }

    @Override
    public Timeline updateTimelineForVersion(Timeline timeline) throws NamespaceNotFoundException, TimelineNotFoundException {
        if (!namespaceStore.namespaceExists(timeline.getNamespace())) {
            LOG.warn("Namespace '{}' not found when updating timeline version", timeline.getNamespace());
            throw new NamespaceNotFoundException();
        }

        writeTimelineToNitrite(timeline);
        LOG.info("Updated version '{}' for timeline {} in namespace '{}'",
                timeline.getDotVersion(), timeline.getId(), timeline.getNamespace());
        return timeline;
    }

    private void writeTimelineToNitrite(Timeline timeline) throws TimelineNotFoundException, NamespaceNotFoundException {
        // Validate JSON before persisting so malformed payloads are rejected with a 400, consistent with the Mongo store
        try {
            // Use org.bson.Document to validate JSON
            org.bson.Document.parse(timeline.getTimelineJson());
        } catch (Exception e) {
            LOG.error("Invalid JSON format for timeline: {}", e.getMessage());
            throw new JsonParseException(e.getMessage());
        }

        // First verify the timeline exists
        retrieveTimelineVersions(timeline);

        // Find the namespace document
        Filter filter = where(NAMESPACE_FIELD).eq(timeline.getNamespace());
        Document namespaceDoc = timelineCollection.find(filter).firstOrNull();

        if (namespaceDoc != null) {
            List<Document> timelines = new TypeSafeNitriteDocument<>(namespaceDoc, Document.class).getList(TIMELINES_FIELD);
            if (timelines != null) {
                // Create a mutable copy of the list
                timelines = new ArrayList<>(timelines);
                boolean found = false;
                for (int i = 0; i < timelines.size(); i++) {
                    Document timelineDoc = timelines.get(i);
                    if (timelineDoc.get(TIMELINE_ID_FIELD, Integer.class) == timeline.getId()) {
                        // Found the timeline, update its version
                        Document versions = timelineDoc.get(VERSIONS_FIELD, Document.class);
                        if (versions == null) {
                            throw new TimelineNotFoundException();
                        }
                        versions.put(timeline.getMongoVersion(), timeline.getTimelineJson());
                        timelineDoc.put(VERSIONS_FIELD, versions);
                        // Defensive: the REST layer enforces @NotBlank on name/description via CreateTimelineRequest,
                        // so these guards are only reachable by non-REST callers (e.g. direct store usage in tests).
                        if (timeline.getName() != null && !timeline.getName().isBlank()) {
                            timelineDoc.put(NAME_FIELD, timeline.getName());
                        }
                        if (timeline.getDescription() != null && !timeline.getDescription().isBlank()) {
                            timelineDoc.put(DESCRIPTION_FIELD, timeline.getDescription());
                        }
                        timelines.set(i, timelineDoc);
                        found = true;
                        break;
                    }
                }

                if (found) {
                    namespaceDoc.put(TIMELINES_FIELD, timelines);
                    timelineCollection.update(filter, namespaceDoc);
                    return;
                }
            }
        }

        LOG.warn("Timeline with ID {} not found in namespace '{}'", timeline.getId(), timeline.getNamespace());
        throw new TimelineNotFoundException();
    }

    private boolean versionExists(Timeline timeline) {
        try {
            Document result = retrieveTimelineVersions(timeline);

            List<Document> timelines = new TypeSafeNitriteDocument<>(result, Document.class).getList(TIMELINES_FIELD);
            for (Document timelineDoc : timelines) {
                if (timeline.getId() == timelineDoc.get(TIMELINE_ID_FIELD, Integer.class)) {
                    Document versions = timelineDoc.get(VERSIONS_FIELD, Document.class);
                    if (versions != null && versions.containsKey(timeline.getMongoVersion())) {
                        return true;  // The version already exists
                    }
                }
            }
        } catch (NamespaceNotFoundException | TimelineNotFoundException e) {
            return false;
        }

        return false;
    }
}
