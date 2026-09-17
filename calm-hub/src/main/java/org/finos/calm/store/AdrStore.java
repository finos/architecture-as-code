package org.finos.calm.store;

import org.finos.calm.domain.adr.AdrMeta;
import org.finos.calm.domain.adr.NamespaceAdrSummary;
import org.finos.calm.domain.adr.Status;
import org.finos.calm.domain.exception.AdrNotFoundException;
import org.finos.calm.domain.exception.AdrParseException;
import org.finos.calm.domain.exception.AdrPersistenceException;
import org.finos.calm.domain.exception.AdrRevisionExistsException;
import org.finos.calm.domain.exception.AdrRevisionNotFoundException;
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
    AdrMeta createAdrForNamespace(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrParseException;
    AdrMeta getAdr(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, AdrParseException;
    List<Integer> getAdrRevisions(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException;
    AdrMeta getAdrRevision(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, AdrParseException;
    AdrMeta updateAdrForNamespace(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, AdrPersistenceException, AdrParseException, AdrRevisionExistsException;
    AdrMeta updateAdrStatus(AdrMeta adrMeta, Status status) throws AdrNotFoundException, NamespaceNotFoundException, AdrRevisionNotFoundException, AdrPersistenceException, AdrParseException, AdrRevisionExistsException;

    /**
     * Deletes an ADR and all of its revisions.
     */
    void deleteAdr(String namespace, int adrId) throws NamespaceNotFoundException, AdrNotFoundException;
}
