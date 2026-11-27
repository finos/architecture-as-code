package org.finos.calm.services;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.domain.GitHubResourceId;
import org.finos.calm.domain.NumericResourceId;
import org.finos.calm.domain.ResourceId;
import org.finos.calm.domain.ResourceIds;
import org.finos.calm.domain.ResourceType;
import org.finos.calm.domain.exception.InvalidResourceIdException;
import org.finos.calm.domain.exception.MappingNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;

/**
 * Turns the string id carried by a request into the {@link ResourceId} shape of the active store.
 *
 * <p>Both API surfaces use this one resolver: storage routes pass the raw path id, name-based
 * routes pass a slug that may need resolving to a numeric id. Delegating the name lookup to
 * {@link MappingControllerService} keeps resolution consistent with every other name-based path.</p>
 */
@ApplicationScoped
public class ResourceIdResolver {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject
    MappingControllerService mappingService;

    public boolean isGitHub() {
        return "github".equalsIgnoreCase(databaseMode);
    }

    /** Resolves a storage-route path id. Numeric modes accept only a positive int. */
    public ResourceId forStorage(String rawId, String path, String variant) {
        if (rawId == null || rawId.isBlank()) {
            throw new InvalidResourceIdException("The resource id is required");
        }
        if (isGitHub()) {
            return new GitHubResourceId(rawId, path, variant);
        }
        return new NumericResourceId(ResourceIds.parseNumeric(rawId));
    }

    /** Resolves a name-based route slug. Numeric modes resolve it through the mapping store. */
    public ResourceId forName(String namespace, ResourceType type, String name, String path, String variant)
            throws MappingNotFoundException, NamespaceNotFoundException {
        if (name == null || name.isBlank()) {
            throw new InvalidResourceIdException("The resource name is required");
        }
        if (isGitHub()) {
            return new GitHubResourceId(name, path, variant);
        }
        return new NumericResourceId(mappingService.getMapping(namespace, type, name).getNumericId());
    }

    /** Numeric form for int-based store calls; GitHub ids yield 0 as those stores do not serve them. */
    public int numericForWrite(ResourceId id) {
        if (id instanceof NumericResourceId numeric) {
            return numeric.value();
        }
        return 0;
    }
}
