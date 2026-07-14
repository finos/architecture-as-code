package org.finos.calm.store.mongo;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.Projections;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.finos.calm.store.PageRequest;

/**
 * Shared helper for the Mongo stores' one-document-per-namespace listing queries.
 *
 * <p>The {@code architectures}/{@code patterns} collections hold a single document per namespace with
 * the resources in an array field. When a {@link PageRequest} is paged, the window is pushed down to
 * Mongo via a {@link Projections#slice(String, int, int)} projection so only the requested slice of
 * the array is returned rather than the whole list. When unpaged, a plain {@code find(...).first()}
 * returns the full document (unchanged behaviour).
 */
final class MongoResourceSlice {

    private MongoResourceSlice() {
    }

    /**
     * Find the single namespace document, optionally slicing the resource array to the paging window.
     *
     * <p>{@code $slice} needs a limit, so an offset without a limit is not expressible and is only
     * honoured alongside a limit. {@link PageRequest#normalizedOffset()} clamps a negative offset to
     * {@code 0} — Mongo would otherwise treat a negative skip as "count from the end", diverging from
     * the in-memory Nitrite path.
     *
     * @param collection the namespace-scoped collection ({@code architectures} or {@code patterns})
     * @param filter     the namespace filter
     * @param arrayField the resource array field name to slice
     * @param page       the paging window
     * @return the (possibly sliced) namespace document, or {@code null} when no document matches
     */
    static Document findNamespaceDoc(MongoCollection<Document> collection, Bson filter, String arrayField, PageRequest page) {
        if (page.isPaged()) {
            return collection.find(filter)
                    .projection(Projections.slice(arrayField, page.normalizedOffset(), page.limit()))
                    .first();
        }
        return collection.find(filter).first();
    }
}
