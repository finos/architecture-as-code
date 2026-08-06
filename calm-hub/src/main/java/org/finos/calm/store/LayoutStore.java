package org.finos.calm.store;

import org.finos.calm.domain.exception.NamespaceNotFoundException;

import java.util.List;
import java.util.Optional;

/**
 * Interface for storing the shared, default layout of an architecture: where its nodes are
 * drawn in the CALM Hub visualiser. There is exactly one layout per architecture — saving is
 * an upsert, not a create-with-allocated-id — and, unlike every other namespace-scoped
 * resource, a layout is <b>not versioned</b>. It is keyed by namespace + architectureId alone
 * and floats across every version of the architecture it targets, matching the deliberate
 * version-stripping already used by the CALM Hub UI's client-side layout cache
 * (see {@code calm-hub-ui/src/visualizer/components/drawer/Drawer.tsx}).
 *
 * <p>The layout content itself is treated as an opaque JSON string here, the same convention
 * as {@link org.finos.calm.store.DecoratorStore}. It is a CALM Hub-internal shape, not a
 * validated CALM community schema; its structure is documented by {@code CalmLayout} on the
 * frontend and by this interface's own Javadoc, not by an external schema file.</p>
 */
public interface LayoutStore {

    /**
     * Retrieve the default layout for an architecture, if one has been saved.
     *
     * @param namespace      the namespace the architecture belongs to
     * @param architectureId the id of the architecture
     * @return the layout JSON, or empty if no default layout has been saved
     * @throws NamespaceNotFoundException if the namespace does not exist
     */
    Optional<String> getLayout(String namespace, int architectureId) throws NamespaceNotFoundException;

    /**
     * Save the default layout for an architecture, creating it if none exists yet or
     * overwriting whatever was saved before.
     *
     * @param namespace      the namespace the architecture belongs to
     * @param architectureId the id of the architecture
     * @param layoutJson     the layout as a raw JSON string
     * @throws NamespaceNotFoundException if the namespace does not exist
     */
    void upsertLayout(String namespace, int architectureId, String layoutJson) throws NamespaceNotFoundException;

    /**
     * Architecture ids in this namespace that currently have a saved default layout. Used
     * only by {@code NamespaceContentService} to guard namespace deletion.
     *
     * @param namespace the namespace to check
     * @return the architecture ids with a saved layout
     * @throws NamespaceNotFoundException if the namespace does not exist
     */
    List<Integer> getArchitectureIdsWithLayoutForNamespace(String namespace) throws NamespaceNotFoundException;
}
