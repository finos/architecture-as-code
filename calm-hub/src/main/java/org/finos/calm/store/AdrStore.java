package org.finos.calm.store;

import org.finos.calm.domain.adr.Adr;
import org.finos.calm.domain.adr.AdrStatus;
import org.finos.calm.domain.exception.AdrNotFoundException;
import org.finos.calm.domain.exception.AdrParseException;
import org.finos.calm.domain.exception.AdrPersistenceException;
import org.finos.calm.domain.exception.AdrRevisionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;

import java.util.List;

public interface AdrStore {

    List<Integer> getAdrsForNamespace(String namespace) throws NamespaceNotFoundException;
    Adr createAdrForNamespace(Adr adr) throws NamespaceNotFoundException, AdrParseException;
    Adr getAdr(Adr adr) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, AdrParseException;
    List<Integer> getAdrRevisions(Adr adr) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException;
    Adr getAdrRevision(Adr adr) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, AdrParseException;
    Adr updateAdrForNamespace(Adr adr) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, AdrPersistenceException, AdrParseException;
    Adr updateAdrStatus(Adr adr, AdrStatus adrStatus) throws AdrNotFoundException, NamespaceNotFoundException, AdrRevisionNotFoundException, AdrPersistenceException, AdrParseException;
}
