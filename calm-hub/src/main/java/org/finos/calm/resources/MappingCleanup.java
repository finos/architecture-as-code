package org.finos.calm.resources;

import org.finos.calm.domain.ResourceType;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.ResourceMappingStore;
import org.slf4j.Logger;

/**
 * Best-effort cleanup of a resource's custom-id mapping after its underlying resource has
 * already been deleted, shared by the five resource types the name-based ({@code /calm}) API
 * can map: Architecture, Flow, Interface, Pattern, Standard.
 *
 * <p>Without this, deleting a resource that was created (or is also reachable) through the
 * name-based API leaves its {@code resource_mappings} entry behind: recreating it under the
 * same custom ID then fails with {@code DuplicateMappingException}, and the custom-id route
 * keeps resolving to a numeric ID that no longer exists.</p>
 *
 * <p>Most resources have no mapping at all — a custom ID only exists for resources written
 * through the name-based API — so {@link ResourceMappingStore#deleteMappingByNumericId} is a
 * no-op in the common case. The underlying resource is already gone by the time this runs, so
 * a failure here is logged and swallowed rather than failing the delete response over cleanup
 * that can't be rolled back into an undelete anyway.</p>
 */
final class MappingCleanup {

    private MappingCleanup() {
    }

    static void deleteMapping(ResourceMappingStore mappingStore, Logger logger,
                               String namespace, ResourceType type, int numericId) {
        try {
            mappingStore.deleteMappingByNumericId(namespace, type, numericId);
        } catch (NamespaceNotFoundException e) {
            logger.warn("Could not clean up the mapping for {} [{}] in namespace [{}] after delete "
                    + "— the namespace no longer exists", type, numericId, namespace, e);
        } catch (RuntimeException e) {
            // A driver/DB failure (MongoException, a Nitrite lock/store error, ...) must not
            // surface as an unhandled 500 for a delete that has already succeeded.
            logger.warn("Could not clean up the mapping for {} [{}] in namespace [{}] after delete",
                    type, numericId, namespace, e);
        }
    }
}
