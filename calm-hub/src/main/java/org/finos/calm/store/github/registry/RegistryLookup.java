package org.finos.calm.store.github.registry;

import org.finos.calm.domain.exception.InvalidResourceIdException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

/** Turns the list returned by a partial registry lookup into at most one entry, failing closed. */
public final class RegistryLookup {

    private static final Logger LOG = LoggerFactory.getLogger(RegistryLookup.class);

    private RegistryLookup() {
    }

    /**
     * Returns the sole match, or {@code null} when there is none so callers can raise their own
     * typed not-found exception. More than one match is ambiguous: candidates go to the log only,
     * never into the client response, and the caller gets a 400 before it can serve the wrong file.
     */
    public static RegistryEntry singleOrNull(List<RegistryEntry> matches) {
        if (matches == null || matches.isEmpty()) {
            return null;
        }
        if (matches.size() == 1) {
            return matches.get(0);
        }
        List<String> candidates = matches.stream().map(RegistryEntry::filePath).map(Object::toString).toList();
        LOG.warn("Ambiguous resource id: {} matching files, candidates {}", matches.size(), candidates);
        throw new InvalidResourceIdException("Resource id is ambiguous; add path and variant to identify one resource");
    }
}
