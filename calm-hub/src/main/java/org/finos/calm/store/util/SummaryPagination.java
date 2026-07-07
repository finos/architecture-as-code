package org.finos.calm.store.util;

import java.util.List;

/**
 * Applies an optional {@code offset}/{@code limit} window to an already-materialised summary list.
 *
 * <p>Used by the Nitrite stores, which hold a namespace's resources as a single in-memory array and
 * cannot express an array-slice projection at the query layer (unlike Mongo's {@code $slice}). When
 * {@code limit} is {@code null} the list is returned unchanged, preserving the pre-pagination
 * behaviour of the summary endpoints.
 */
public final class SummaryPagination {

    private SummaryPagination() {
    }

    /**
     * Return a sub-list of {@code items} starting at {@code offset} and containing at most
     * {@code limit} elements. Both bounds are clamped to the list size so out-of-range values yield
     * an empty (never throwing) result.
     *
     * @param items  the full, already-built list of summaries
     * @param limit  the maximum number of items to return, or {@code null} for no limit
     * @param offset the number of items to skip, or {@code null} for none
     * @param <T>    the summary element type
     * @return the requested window, or {@code items} unchanged when {@code limit} is {@code null}
     */
    public static <T> List<T> paginate(List<T> items, Integer limit, Integer offset) {
        if (limit == null) {
            return items;
        }
        int size = items.size();
        int from = Math.min(offset == null ? 0 : Math.max(offset, 0), size);
        int to = Math.min(from + Math.max(limit, 0), size);
        return items.subList(from, to);
    }
}
