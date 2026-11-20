package org.finos.calm.store;

import org.finos.calm.domain.adr.AdrMeta;
import org.finos.calm.domain.adr.AdrSlugMapping;
import org.finos.calm.domain.adr.NamespaceAdrSummary;
import org.finos.calm.domain.adr.Status;
import org.finos.calm.domain.exception.AdrNotFoundException;
import org.finos.calm.domain.exception.AdrParseException;
import org.finos.calm.domain.exception.AdrPersistenceException;
import org.finos.calm.domain.exception.AdrRevisionExistsException;
import org.finos.calm.domain.exception.AdrRevisionNotFoundException;
import org.finos.calm.domain.exception.AdrSlugExistsException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;

import java.util.List;

public interface AdrStore {

    List<NamespaceAdrSummary> getAdrsForNamespace(String namespace) throws NamespaceNotFoundException;

    /**
     * @return how many ADRs the namespace holds.
     *
     * <p>Deliberately not {@code getAdrsForNamespace(namespace).size()}. An ADR summary
     * carries the latest revision's title and status, so building the list costs two reads
     * and a JSON parse per ADR; callers that only want a number would pay that for nothing.
     * Every other type's summary comes straight off its header, which is why only ADR needs
     * this.</p>
     */
    int countAdrsForNamespace(String namespace) throws NamespaceNotFoundException;

    /**
     * Creates an ADR at revision 1 and gives it a slug that is unique in its namespace.
     *
     * <p>A valid slug on {@code adrMeta} is used as given. Otherwise the slug is derived from
     * the title, or is {@code adr-{id}} when the title gives none; a derived slug that is
     * taken gets the first free {@code -2}, {@code -3}, ... suffix.</p>
     *
     * @throws AdrSlugExistsException if the caller requested a slug that another ADR holds
     */
    AdrMeta createAdrForNamespace(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrParseException, AdrSlugExistsException;
    AdrMeta getAdr(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, AdrParseException;
    List<Integer> getAdrRevisions(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException;
    AdrMeta getAdrRevision(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, AdrParseException;

    /**
     * Writes a new revision with {@code adrMeta}'s content. The status is carried over from
     * the latest revision; use {@link #createAdrRevision} to set it from the content.
     */
    AdrMeta updateAdrForNamespace(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, AdrPersistenceException, AdrParseException, AdrRevisionExistsException;

    /**
     * Writes a new revision with exactly {@code adrMeta}'s content, status included. A null
     * status keeps the latest revision's.
     */
    AdrMeta createAdrRevision(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, AdrParseException, AdrRevisionExistsException;
    AdrMeta updateAdrStatus(AdrMeta adrMeta, Status status) throws AdrNotFoundException, NamespaceNotFoundException, AdrRevisionNotFoundException, AdrPersistenceException, AdrParseException, AdrRevisionExistsException;

    /**
     * Deletes an ADR and all of its revisions.
     */
    void deleteAdr(String namespace, int adrId) throws NamespaceNotFoundException, AdrNotFoundException;

    /**
     * @throws AdrNotFoundException if no ADR in the namespace has the slug
     */
    int getAdrIdBySlug(String namespace, String slug) throws NamespaceNotFoundException, AdrNotFoundException;

    /**
     * @return every slug in the namespace and the ADR it addresses, in ascending id order.
     * An ADR with no slug yet (stored before slugs, not yet migrated) is left out.
     */
    List<AdrSlugMapping> getAdrSlugs(String namespace) throws NamespaceNotFoundException;

    /**
     * The version labels the name-based API lists for an ADR. Revision numbers, ascending,
     * unless a store has a different notion of a version.
     */
    default List<String> getAdrVersions(String namespace, int adrId)
            throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException {
        AdrMeta adrMeta = new AdrMeta.AdrMetaBuilder().setNamespace(namespace).setId(adrId).build();
        return getAdrRevisions(adrMeta).stream().map(String::valueOf).toList();
    }

    /**
     * Reads the ADR at a version label from {@link #getAdrVersions}.
     *
     * @throws AdrRevisionNotFoundException if no version has that label
     */
    default AdrMeta getAdrForVersion(String namespace, int adrId, String version)
            throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, AdrParseException {
        int revision;
        try {
            revision = Integer.parseInt(version);
        } catch (NumberFormatException e) {
            throw new AdrRevisionNotFoundException();
        }
        return getAdrRevision(new AdrMeta.AdrMetaBuilder()
                .setNamespace(namespace).setId(adrId).setRevision(revision).build());
    }

    /**
     * @return the version label of {@code latest}, an ADR read by {@link #getAdr}.
     */
    default String getVersionLabel(AdrMeta latest) {
        return String.valueOf(latest.getRevision());
    }
}
