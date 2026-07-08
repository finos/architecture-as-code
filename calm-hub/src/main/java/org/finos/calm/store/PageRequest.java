package org.finos.calm.store;

import java.util.List;

/**
 * An optional {@code limit}/{@code offset} paging window for a namespace resource listing.
 *
 * <p>A {@code null} {@code limit} means "unpaged": the full list is returned unchanged, preserving
 * the pre-pagination behaviour of the summary endpoints. Stores that can express an array-slice at
 * the query layer (Mongo's {@code $slice}) push the window down; stores that hold the resources as a
 * single in-memory array (Nitrite) apply {@link #apply(List)} after materialising the list.
 *
 * @param limit  the maximum number of items to return, or {@code null} for no limit (unpaged)
 * @param offset the number of items to skip, or {@code null} for none
 */
public record PageRequest(Integer limit, Integer offset) {

    /** The unpaged request: no limit, no offset. Returns the full list unchanged. */
    public static final PageRequest UNPAGED = new PageRequest(null, null);

    /**
     * @return {@code true} when a limit is set and a paging window should be applied.
     */
    public boolean isPaged() {
        return limit != null;
    }

    /**
     * @return the offset clamped to {@code >= 0} (a {@code null} or negative offset becomes {@code 0}).
     */
    public int normalizedOffset() {
        return (offset == null || offset < 0) ? 0 : offset;
    }

    /**
     * Apply this paging window to an already-materialised list.
     *
     * <p>When unpaged the list is returned unchanged (same instance). Otherwise a sub-list starting
     * at {@link #normalizedOffset()} and containing at most {@code limit} elements is returned. Both
     * bounds are clamped to the list size using {@code long} arithmetic, so out-of-range or overflow
     * values (e.g. {@code limit = Integer.MAX_VALUE}) yield an empty (never throwing) result.
     *
     * @param items the full, already-built list of items
     * @param <T>   the element type
     * @return the requested window, or {@code items} unchanged when unpaged
     */
    public <T> List<T> apply(List<T> items) {
        if (!isPaged()) {
            return items;
        }
        int size = items.size();
        int from = (int) Math.min(normalizedOffset(), size);
        // long arithmetic guards against int overflow when offset + limit exceeds Integer.MAX_VALUE.
        long safeLimit = Math.max(limit.longValue(), 0L);
        int to = (int) Math.min(from + safeLimit, size);
        return items.subList(from, to);
    }
}
