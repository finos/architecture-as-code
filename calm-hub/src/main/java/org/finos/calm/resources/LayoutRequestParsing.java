package org.finos.calm.resources;

import org.bson.Document;
import org.bson.json.JsonParseException;

/**
 * Shared body-parsing and path-building logic for {@link LayoutResource} and
 * {@link PatternLayoutResource}'s {@code saveLayout} endpoints, which are structural
 * twins of each other — see {@link PatternLayoutStore}'s class javadoc.
 */
final class LayoutRequestParsing {

    private LayoutRequestParsing() {
    }

    /**
     * Parses a layout request body just far enough to read its optional {@code for}
     * property, so a save whose {@code for} silently names a different resource than the
     * URL can be rejected before it reaches the store. A layout with no {@code for} at all
     * is accepted; the field's contract is defined entirely by the caller's own behaviour —
     * compared against {@link #canonicalPath} and rejected with a 400 on mismatch — not by
     * an external schema document.
     *
     * @throws JsonParseException if the body is null, blank, or not valid JSON
     */
    static String parseForTarget(String layoutJson) {
        // A null body would NPE straight into Document.parse; an absent body instead arrives
        // here as "" (confirmed empirically — RESTEasy binds a missing raw-String entity to an
        // empty string, not null), which Document.parse doesn't reject as malformed JSON either
        // — it throws BsonInvalidOperationException, a different exception entirely, one that
        // the JsonParseException catch below doesn't see. Both must be rejected up front so
        // every "no real body" case lands on the same honest 400.
        if (layoutJson == null || layoutJson.isBlank()) {
            throw new JsonParseException("Layout JSON must not be null or empty");
        }
        Document parsed = Document.parse(layoutJson);
        Object forTarget = parsed.get("for");
        return forTarget instanceof String forPath ? forPath : null;
    }

    /**
     * Builds the canonical path for a numeric-ID resource, e.g.
     * {@code /api/calm/namespaces/finos/architectures/5}.
     *
     * @param resourceTypeSegment the plural path segment for the resource type
     *                            (e.g. {@code "architectures"}, {@code "patterns"})
     */
    static String canonicalPath(String namespace, String resourceTypeSegment, int id) {
        return "/api/calm/namespaces/" + namespace + "/" + resourceTypeSegment + "/" + id;
    }
}
