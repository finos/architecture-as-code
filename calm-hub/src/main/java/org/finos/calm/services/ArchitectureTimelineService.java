package org.finos.calm.services;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.finos.calm.domain.Architecture;
import org.finos.calm.domain.Semver;
import org.finos.calm.domain.exception.ArchitectureNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.TimelineNotFoundException;
import org.finos.calm.domain.exception.TimelineVersionNotFoundException;
import org.finos.calm.domain.timeline.NamespaceTimelineSummary;
import org.finos.calm.domain.timeline.Timeline;
import org.finos.calm.store.ArchitectureStore;
import org.finos.calm.store.TimelineStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Builds a CALM timeline document for an architecture.
 *
 * <p>If a stored (explicit) timeline in the same namespace references this architecture — i.e.
 * one of its moments' {@code detailed-architecture} points at a version of this architecture —
 * that timeline is returned in preference. Otherwise the service returns the <em>implied</em>
 * projection of the architecture's version history (issue #2289).</p>
 *
 * <h2>Ordering rule</h2>
 * Architecture versions are projected into moments ordered as follows:
 * <ol>
 *   <li>Versions that parse as valid semver are sorted ascending by semver first.</li>
 *   <li>Versions that are not valid semver keep their original storage order and are
 *       appended after the semver-ordered versions.</li>
 * </ol>
 * {@code current-moment} is the unique-id of the last moment in the resulting order (the
 * highest semver, or — if all versions are non-semver — the last in storage order).
 */
@ApplicationScoped
public class ArchitectureTimelineService {

    public static final String TIMELINE_SCHEMA = "https://calm.finos.org/release/1.2/meta/calm-timeline.json";

    private final ArchitectureStore architectureStore;
    private final TimelineStore timelineStore;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Logger logger = LoggerFactory.getLogger(ArchitectureTimelineService.class);

    @Inject
    public ArchitectureTimelineService(ArchitectureStore architectureStore, TimelineStore timelineStore) {
        this.architectureStore = architectureStore;
        this.timelineStore = timelineStore;
    }

    /**
     * Returns a CALM timeline document for the given architecture as a JSON string.
     *
     * @param namespace      the namespace the architecture belongs to
     * @param architectureId the id of the architecture
     * @return a JSON document conforming to the CALM timeline schema
     */
    public String getTimelineForArchitecture(String namespace, int architectureId)
            throws NamespaceNotFoundException, ArchitectureNotFoundException, JsonProcessingException {

        String explicit = findExplicitTimeline(namespace, architectureId);
        if (explicit != null) {
            logger.debug("Returning explicit timeline for architecture {} in namespace '{}'",
                    architectureId, namespace);
            return explicit;
        }
        return buildImpliedTimeline(namespace, architectureId);
    }

    /**
     * Finds a stored timeline in the namespace whose moments reference a version of this
     * architecture, returning its latest version's JSON. Returns {@code null} when no stored
     * timeline references the architecture.
     *
     * <p>A timeline "belongs to" an architecture when any moment's {@code detailed-architecture}
     * reference contains {@code /architectures/{id}/versions/}. The {@code /versions/} suffix
     * keeps the match exact so e.g. architecture 6 is not matched by a reference to 60.</p>
     */
    private String findExplicitTimeline(String namespace, int architectureId)
            throws NamespaceNotFoundException {

        String marker = "/architectures/" + architectureId + "/versions/";
        List<NamespaceTimelineSummary> summaries = timelineStore.getTimelinesForNamespace(namespace);

        for (NamespaceTimelineSummary summary : summaries) {
            try {
                Timeline base = new Timeline.TimelineBuilder()
                        .setNamespace(namespace)
                        .setId(summary.getId())
                        .build();

                List<String> versions = timelineStore.getTimelineVersions(base);
                if (versions == null || versions.isEmpty()) {
                    continue;
                }

                String latest = orderVersions(versions).get(versions.size() - 1);
                Timeline versioned = new Timeline.TimelineBuilder()
                        .setNamespace(namespace)
                        .setId(summary.getId())
                        .setVersion(latest)
                        .build();

                String timelineJson = timelineStore.getTimelineForVersion(versioned);
                if (referencesArchitecture(timelineJson, marker)) {
                    return timelineJson;
                }
            } catch (TimelineNotFoundException | TimelineVersionNotFoundException e) {
                logger.debug("Skipping timeline {} while resolving explicit timeline for architecture {}",
                        summary.getId(), architectureId, e);
            }
        }
        return null;
    }

    private boolean referencesArchitecture(String timelineJson, String marker) {
        try {
            JsonNode moments = objectMapper.readTree(timelineJson).path("moments");
            if (moments.isArray()) {
                for (JsonNode moment : moments) {
                    JsonNode ref = moment.path("details").path("detailed-architecture");
                    if (ref.isTextual() && ref.asText().contains(marker)) {
                        return true;
                    }
                }
            }
        } catch (JsonProcessingException e) {
            logger.warn("Could not parse stored timeline JSON while matching architecture references", e);
        }
        return false;
    }

    private String buildImpliedTimeline(String namespace, int architectureId)
            throws NamespaceNotFoundException, ArchitectureNotFoundException, JsonProcessingException {

        Architecture architecture = new Architecture.ArchitectureBuilder()
                .setNamespace(namespace)
                .setId(architectureId)
                .build();

        List<String> versions = architectureStore.getArchitectureVersions(architecture);
        List<String> orderedVersions = orderVersions(versions);

        ObjectNode timeline = objectMapper.createObjectNode();
        timeline.put("$schema", TIMELINE_SCHEMA);

        ArrayNode moments = timeline.putArray("moments");
        for (String version : orderedVersions) {
            moments.add(buildMoment(namespace, architectureId, version));
        }

        if (!orderedVersions.isEmpty()) {
            timeline.put("current-moment", orderedVersions.get(orderedVersions.size() - 1));
        }

        logger.debug("Built implied timeline for architecture {} in namespace '{}' with {} moments",
                architectureId, namespace, orderedVersions.size());

        return objectMapper.writeValueAsString(timeline);
    }

    /**
     * Orders versions per the documented rule: parseable semver versions ascending first,
     * then non-semver versions in their original storage order appended after.
     *
     * <p>{@link Semver#tryParse(String)} collapses unparseable versions to {@code 0.0.0}, so it
     * cannot be relied upon to distinguish a real {@code 0.0.0} from an unparseable value. We
     * therefore classify versions explicitly using {@link Semver#parse(String)} (which throws on
     * non-semver input) before sorting.</p>
     */
    private List<String> orderVersions(List<String> versions) {
        List<String> semverVersions = new ArrayList<>();
        List<String> nonSemverVersions = new ArrayList<>();

        for (String version : versions) {
            if (isSemver(version)) {
                semverVersions.add(version);
            } else {
                nonSemverVersions.add(version);
            }
        }

        semverVersions.sort(Comparator.comparing(Semver::parse));

        List<String> ordered = new ArrayList<>(semverVersions);
        ordered.addAll(nonSemverVersions);
        return ordered;
    }

    private boolean isSemver(String version) {
        try {
            Semver.parse(version);
            return true;
        } catch (RuntimeException e) {
            return false;
        }
    }

    private ObjectNode buildMoment(String namespace, int architectureId, String version) {
        ObjectNode moment = objectMapper.createObjectNode();
        moment.put("unique-id", version);
        moment.put("node-type", "moment");
        moment.put("name", version);
        moment.put("description", "Architecture " + architectureId + " at version " + version);

        ObjectNode details = moment.putObject("details");
        details.put("detailed-architecture",
                "/calm/namespaces/" + namespace + "/architectures/" + architectureId + "/versions/" + version);

        return moment;
    }
}
