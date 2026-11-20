package org.finos.calm.domain.adr;

/**
 * The slug of an ADR and the numeric id it addresses within a namespace.
 */
public record AdrSlugMapping(String slug, int adrId) {
}
