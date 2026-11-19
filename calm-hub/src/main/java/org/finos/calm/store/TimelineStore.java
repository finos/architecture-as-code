package org.finos.calm.store;

import org.finos.calm.domain.ResourceId;
import org.finos.calm.domain.ResourceIds;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.TimelineNotFoundException;
import org.finos.calm.domain.exception.TimelineVersionExistsException;
import org.finos.calm.domain.exception.TimelineVersionNotFoundException;
import org.finos.calm.domain.timeline.CreateTimelineRequest;
import org.finos.calm.domain.timeline.NamespaceTimelineSummary;
import org.finos.calm.domain.timeline.Timeline;

import java.util.List;

public interface TimelineStore {
    List<NamespaceTimelineSummary> getTimelinesForNamespace(String namespace) throws NamespaceNotFoundException;
    Timeline createTimelineForNamespace(CreateTimelineRequest timelineRequest, String namespace) throws NamespaceNotFoundException;
    Timeline createTimelineForNamespace(CreateTimelineRequest timelineRequest, String namespace, String version) throws NamespaceNotFoundException;
    List<String> getTimelineVersions(Timeline timeline) throws NamespaceNotFoundException, TimelineNotFoundException;
    String getTimelineForVersion(Timeline timeline) throws NamespaceNotFoundException, TimelineNotFoundException, TimelineVersionNotFoundException;

    default List<String> getTimelineVersions(String namespace, ResourceId id) throws NamespaceNotFoundException, TimelineNotFoundException {
        return getTimelineVersions(new Timeline.TimelineBuilder()
                .setNamespace(namespace).setId(ResourceIds.numeric(id)).build());
    }

    default String getTimelineForVersion(String namespace, ResourceId id, String version) throws NamespaceNotFoundException, TimelineNotFoundException, TimelineVersionNotFoundException {
        return getTimelineForVersion(new Timeline.TimelineBuilder()
                .setNamespace(namespace).setId(ResourceIds.numeric(id)).setVersion(version).build());
    }
    Timeline createTimelineForVersion(Timeline timeline) throws NamespaceNotFoundException, TimelineNotFoundException, TimelineVersionExistsException;
    Timeline updateTimelineForVersion(Timeline timeline) throws NamespaceNotFoundException, TimelineNotFoundException;

    /**
     * Deletes a timeline and all of its versions.
     */
    void deleteTimeline(String namespace, int timelineId) throws NamespaceNotFoundException, TimelineNotFoundException;

    /**
     * Deletes a single version of a timeline, leaving the timeline header and other versions intact.
     *
     * @return {@code true} if the version was present and deleted, {@code false} if no such version was stored.
     */
    boolean deleteTimelineVersion(String namespace, int timelineId, String version)
            throws NamespaceNotFoundException, TimelineNotFoundException;
}
