package org.finos.calm.store;

import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.PatternNotFoundException;

import java.util.List;
import java.util.Optional;

/**
 * Interface for storing the shared, default layout of a pattern: where its nodes are drawn in
 * the CALM Hub visualiser. A structural twin of {@link LayoutStore}, kept as a separate
 * interface and storage family (its own {@code pattern_layouts} collection) rather than a
 * generalized {@code resourceType}-discriminated extension of {@link LayoutStore}, because
 * architecture ids and pattern ids are drawn from independent counters and can coincide within
 * one namespace; a single collection keyed only by id would need that discriminator threaded
 * through every filter and the unique index to avoid an architecture and a pattern silently
 * sharing one layout document. There is exactly one layout per pattern — saving is an upsert,
 * not a create-with-allocated-id — and, like an architecture's layout, a pattern's layout is
 * <b>not versioned</b>: it is keyed by namespace + patternId alone and floats across every
 * version of the pattern it targets.
 *
 * <p>The layout content itself is treated as an opaque JSON string here, the same convention as
 * {@link LayoutStore} and {@link org.finos.calm.store.DecoratorStore}.</p>
 */
public interface PatternLayoutStore {

    /**
     * Retrieve the default layout for a pattern, if one has been saved.
     *
     * @param namespace the namespace the pattern belongs to
     * @param patternId the id of the pattern
     * @return the layout JSON, or empty if no default layout has been saved
     * @throws NamespaceNotFoundException if the namespace does not exist
     */
    Optional<String> getLayout(String namespace, int patternId) throws NamespaceNotFoundException;

    /**
     * Save the default layout for a pattern, creating it if none exists yet or overwriting
     * whatever was saved before. Rejects a write against a pattern id that doesn't exist, so a
     * layout can never be saved as an orphan with nothing to attach to — the implementation
     * checks this itself rather than requiring the caller to check {@code PatternStore} first,
     * so the whole save is one round trip through the namespace check instead of two. Mirrors
     * {@link LayoutStore#upsertLayout}.
     *
     * @param namespace  the namespace the pattern belongs to
     * @param patternId  the id of the pattern
     * @param layoutJson the layout as a raw JSON string
     * @throws NamespaceNotFoundException if the namespace does not exist
     * @throws PatternNotFoundException   if no pattern with this id exists in the namespace
     */
    void upsertLayout(String namespace, int patternId, String layoutJson)
            throws NamespaceNotFoundException, PatternNotFoundException;

    /**
     * Pattern ids in this namespace that currently have a saved default layout. Used only by
     * {@code NamespaceContentService} to guard namespace deletion.
     *
     * @param namespace the namespace to check
     * @return the pattern ids with a saved layout
     * @throws NamespaceNotFoundException if the namespace does not exist
     */
    List<Integer> getPatternIdsWithLayoutForNamespace(String namespace) throws NamespaceNotFoundException;
}
