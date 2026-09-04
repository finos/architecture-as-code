package org.finos.calm.security;

import org.finos.calm.domain.audit.AuditEntityType;

import java.util.List;

/**
 * Extracts an entity ID (and, where present, a version) from the path of a
 * {@code Location} response header, for the handful of server-generated-ID create
 * endpoints where the new entity's identity isn't already available as a resolved
 * JAX-RS path parameter.
 *
 * <p>This is coupled to each resource's specific {@code Response.created(new URI(...))}
 * call sites — see {@link AuditRequestFilter} for the full list of endpoints this
 * supports. If a resource's URI-building code changes shape, the corresponding case
 * here needs a matching update, or that endpoint's CREATE audit records will silently
 * stop carrying an entity ID.</p>
 */
final class LocationSegmentParser {

    private LocationSegmentParser() {
    }

    record LocationIds(String entityId, String version) {
    }

    static LocationIds parse(AuditEntityType entityType, String locationPath) {
        if (locationPath == null || locationPath.isBlank()) {
            return new LocationIds(null, null);
        }
        String stripped = locationPath.replaceAll("^/+", "");
        if (stripped.isBlank()) {
            return new LocationIds(null, null);
        }
        List<String> segments = List.of(stripped.split("/"));

        return switch (entityType) {
            // .../namespaces/{name}  or  .../domains/{name}
            case NAMESPACE, DOMAIN -> new LocationIds(lastSegment(segments), null);
            // .../schemas/{version}/meta
            case SCHEMA -> new LocationIds(segmentBefore(segments, "meta"), null);
            // .../{plural}/{id}/versions/{version}
            case ARCHITECTURE, PATTERN, FLOW, INTERFACE, STANDARD, TIMELINE, BUILDING_BLOCK, CONTROL ->
                    new LocationIds(segmentBefore(segments, "versions"), segmentAfter(segments, "versions"));
            // .../adrs/{id}/revisions/{revision}
            case ADR -> new LocationIds(segmentBefore(segments, "revisions"), segmentAfter(segments, "revisions"));
            // .../domains/{domain}/controls/{controlId}  (initial control+requirement creation)
            case CONTROL_REQUIREMENT -> new LocationIds(lastSegment(segments), null);
            // .../domains/{domain}/controls/{controlId}/configurations/{configId}
            case CONTROL_CONFIGURATION -> new LocationIds(lastSegment(segments), null);
            // .../{namespace|domain}/user-access/{id}
            case USER_ACCESS -> new LocationIds(lastSegment(segments), null);
            // .../decorators/{id}
            case DECORATOR -> new LocationIds(lastSegment(segments), null);
            // Layout PUT always returns 204 with no Location header, so these two cases are
            // unreachable at runtime — parse() short-circuits on a null/blank locationPath
            // before reaching this switch. They exist only because the switch is exhaustive
            // over AuditEntityType and LAYOUT/PATTERN_LAYOUT must be handled to compile.
            case LAYOUT, PATTERN_LAYOUT -> new LocationIds(null, null);
        };
    }

    private static String lastSegment(List<String> segments) {
        return segments.isEmpty() ? null : segments.get(segments.size() - 1);
    }

    private static String segmentBefore(List<String> segments, String anchor) {
        int idx = segments.indexOf(anchor);
        return idx > 0 ? segments.get(idx - 1) : null;
    }

    private static String segmentAfter(List<String> segments, String anchor) {
        int idx = segments.indexOf(anchor);
        return idx >= 0 && idx + 1 < segments.size() ? segments.get(idx + 1) : null;
    }
}
