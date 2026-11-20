package org.finos.calm.store.util;

import org.finos.calm.domain.adr.AdrSlugs;
import org.finos.calm.domain.exception.AdrSlugExistsException;
import org.finos.calm.domain.exception.StorageWriteException;

/**
 * Picks the slug a new ADR gets, shared by the stores and the slug migrations so that both
 * apply the same collision rule.
 *
 * <p>The caller supplies the claim. A store's claim is the header insert itself, refused by
 * the unique {@code (namespace, slug)} index, so two concurrent creates cannot both win a
 * slug. A migration's claim is a set of slugs it has already handed out.</p>
 */
public final class AdrSlugAllocator {

    /** Far beyond any real collision run; it only stops a broken claim looping forever. */
    static final int MAX_ATTEMPTS = 1000;

    @FunctionalInterface
    public interface SlugClaim {
        /** @return {@code true} if {@code slug} was free and is now held by this ADR. */
        boolean tryClaim(String slug);
    }

    private AdrSlugAllocator() {
    }

    /**
     * Claims the requested slug if it is valid, else the slug derived from {@code title}.
     *
     * @throws AdrSlugExistsException if the requested slug is valid but taken. A derived slug
     *                                takes the next free {@code -n} suffix instead.
     */
    public static String allocate(String requestedSlug, String title, int adrId, SlugClaim claim)
            throws AdrSlugExistsException {
        if (AdrSlugs.isValid(requestedSlug)) {
            if (claim.tryClaim(requestedSlug)) {
                return requestedSlug;
            }
            throw new AdrSlugExistsException();
        }
        return allocateDerived(title, adrId, claim);
    }

    /** Claims the slug derived from {@code title}, or the first free suffixed form of it. */
    public static String allocateDerived(String title, int adrId, SlugClaim claim) {
        String base = AdrSlugs.deriveOrFallback(title, adrId);
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            String candidate = AdrSlugs.withSuffix(base, attempt);
            if (claim.tryClaim(candidate)) {
                return candidate;
            }
        }
        throw StorageWriteException.writeFailed(new IllegalStateException(
                "No free slug for ADR " + adrId + " after " + MAX_ATTEMPTS + " attempts"));
    }
}
