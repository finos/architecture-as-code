package org.finos.calm.store.mongo;

import com.mongodb.MongoWriteException;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Projections;
import com.mongodb.client.model.UpdateOptions;
import com.mongodb.client.model.Updates;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.TimelineNotFoundException;
import org.finos.calm.domain.exception.TimelineVersionExistsException;
import org.finos.calm.domain.exception.TimelineVersionNotFoundException;
import org.finos.calm.domain.timeline.CreateTimelineRequest;
import org.finos.calm.domain.timeline.NamespaceTimelineSummary;
import org.finos.calm.domain.timeline.Timeline;
import org.finos.calm.store.TimelineStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * MongoDB-backed implementation of {@link TimelineStore}.
 *
 * <h2>Document model &amp; concurrency</h2>
 * Follows the same namespace-scoped document pattern as {@link MongoFlowStore} and
 * {@link MongoArchitectureStore}: one document per namespace (enforced by a unique index on
 * {@code timelines.namespace}), with an array of timeline sub-documents. New timelines are
 * added via upsert + {@code $push}, and new versions use an atomic conditional update with
 * {@code $elemMatch} / {@code $exists: false} to prevent duplicate version creation under
 * concurrency. Unique timeline IDs are generated atomically by {@link MongoCounterStore}.
 *
 * @see MongoIndexInitializer
 * @see MongoCounterStore
 */
@ApplicationScoped
@Typed(MongoTimelineStore.class)
public class MongoTimelineStore implements TimelineStore {
    private final MongoCollection<Document> timelineCollection;
    private final MongoCounterStore counterStore;
    private final MongoNamespaceStore namespaceStore;
    private final Logger log = LoggerFactory.getLogger(getClass());

    public MongoTimelineStore(MongoDatabase database, MongoCounterStore counterStore, MongoNamespaceStore namespaceStore) {
        this.counterStore = counterStore;
        this.namespaceStore = namespaceStore;
        this.timelineCollection = database.getCollection("timelines");
    }

    @Override
    public List<NamespaceTimelineSummary> getTimelinesForNamespace(String namespace) throws NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }

        Document namespaceDocument = timelineCollection.find(Filters.eq("namespace", namespace)).first();

        //protects from an unpopulated mongo collection
        if (namespaceDocument == null || namespaceDocument.isEmpty()) {
            return List.of();
        }

        List<Document> timelines = namespaceDocument.getList("timelines", Document.class);
        List<NamespaceTimelineSummary> timelineSummaries = new ArrayList<>();

        for (Document timeline : timelines) {
            Integer timelineId = timeline.getInteger("timelineId");
            String name = timeline.getString("name");
            String description = timeline.getString("description");
            if (name == null) name = "Timeline " + timelineId;
            if (description == null) description = "";
            timelineSummaries.add(new NamespaceTimelineSummary(name, description, timelineId));
        }

        return timelineSummaries;
    }

    @Override
    public Timeline createTimelineForNamespace(CreateTimelineRequest timelineRequest, String namespace) throws NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }

        int id = counterStore.getNextTimelineSequenceValue();
        Document timelineDocument = new Document("timelineId", id)
                .append("name", timelineRequest.getName())
                .append("description", timelineRequest.getDescription())
                .append("versions",
                        new Document("1-0-0", Document.parse(timelineRequest.getTimelineJson())));

        timelineCollection.updateOne(
                Filters.eq("namespace", namespace),
                Updates.push("timelines", timelineDocument),
                new UpdateOptions().upsert(true));

        return new Timeline.TimelineBuilder()
                .setId(id)
                .setVersion("1.0.0")
                .setNamespace(namespace)
                .setTimeline(timelineRequest.getTimelineJson())
                .build();
    }

    @Override
    public List<String> getTimelineVersions(Timeline timeline) throws NamespaceNotFoundException, TimelineNotFoundException {
        Document result = retrieveTimelineVersions(timeline);

        List<Document> timelines = result.getList("timelines", Document.class);
        for (Document timelineDoc : timelines) {
            if (timeline.getId() == timelineDoc.getInteger("timelineId")) {
                // Extract the versions map from the matching timeline
                Document versions = (Document) timelineDoc.get("versions");
                if (versions == null) {
                    throw new TimelineNotFoundException();
                }
                Set<String> versionKeys = versions.keySet();

                // Convert from Mongo representation
                List<String> resourceVersions = new ArrayList<>();
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
            throw new NamespaceNotFoundException();
        }

        Bson filter = new Document("namespace", timeline.getNamespace());
        Bson projection = Projections.fields(Projections.include("timelines"));

        Document result = timelineCollection.find(filter).projection(projection).first();

        if (result == null) {
            throw new TimelineNotFoundException();
        }

        return result;
    }

    @Override
    public String getTimelineForVersion(Timeline timeline) throws NamespaceNotFoundException, TimelineNotFoundException, TimelineVersionNotFoundException {
        Document result = retrieveTimelineVersions(timeline);

        List<Document> timelines = result.getList("timelines", Document.class);
        for (Document timelineDoc : timelines) {
            if (timeline.getId() == timelineDoc.getInteger("timelineId")) {
                // Retrieve the versions map from the matching timeline
                Document versions = (Document) timelineDoc.get("versions");
                if (versions == null) {
                    throw new TimelineVersionNotFoundException();
                }

                // Return the timeline JSON blob for the specified version
                Document versionDoc = (Document) versions.get(timeline.getMongoVersion());
                log.info("VersionDoc: [{}], Mongo Version: [{}]", timelineDoc.get("versions"), timeline.getMongoVersion());
                if (versionDoc == null) {
                    throw new TimelineVersionNotFoundException();
                }
                return versionDoc.toJson();
            }
        }
        // Timelines is empty, no version to find
        throw new TimelineVersionNotFoundException();
    }

    @Override
    public Timeline createTimelineForVersion(Timeline timeline) throws NamespaceNotFoundException, TimelineNotFoundException, TimelineVersionExistsException {
        // Validates namespace and timeline existence
        getTimelineVersions(timeline);

        // Atomic conditional update: only succeeds if the version doesn't already exist
        Document filter = new Document("namespace", timeline.getNamespace())
                .append("timelines", new Document("$elemMatch",
                        new Document("timelineId", timeline.getId())
                                .append("versions." + timeline.getMongoVersion(), new Document("$exists", false))));

        Document update = new Document("$set", buildVersionSetFields(timeline));

        if (timelineCollection.updateOne(filter, update).getMatchedCount() == 0) {
            throw new TimelineVersionExistsException();
        }

        return timeline;
    }

    @Override
    public Timeline updateTimelineForVersion(Timeline timeline) throws NamespaceNotFoundException, TimelineNotFoundException {
        if (!namespaceStore.namespaceExists(timeline.getNamespace())) {
            throw new NamespaceNotFoundException();
        }
        writeTimelineToMongo(timeline);
        return timeline;
    }

    private void writeTimelineToMongo(Timeline timeline) throws TimelineNotFoundException, NamespaceNotFoundException {
        retrieveTimelineVersions(timeline);

        Document filter = new Document("namespace", timeline.getNamespace())
                .append("timelines.timelineId", timeline.getId());
        Document update = new Document("$set", buildVersionSetFields(timeline));

        try {
            timelineCollection.updateOne(filter, update, new UpdateOptions().upsert(true));
        } catch (MongoWriteException ex) {
            log.error("Failed to write timeline to mongo [{}]", timeline, ex);
            throw new TimelineNotFoundException();
        }
    }

    private Document buildVersionSetFields(Timeline timeline) {
        Document setFields = new Document("timelines.$.versions." + timeline.getMongoVersion(), Document.parse(timeline.getTimelineJson()));
        // Defensive: the REST layer enforces @NotBlank on name/description via CreateTimelineRequest,
        // so these guards are only reachable by non-REST callers (e.g. direct store usage in tests).
        if (timeline.getName() != null && !timeline.getName().isBlank()) {
            setFields.append("timelines.$.name", timeline.getName());
        }
        if (timeline.getDescription() != null && !timeline.getDescription().isBlank()) {
            setFields.append("timelines.$.description", timeline.getDescription());
        }
        return setFields;
    }

}
