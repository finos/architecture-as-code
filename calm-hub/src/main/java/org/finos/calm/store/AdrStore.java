package org.finos.calm.store;

import com.fasterxml.jackson.core.JsonProcessingException;
import org.finos.calm.domain.Adr;
import org.finos.calm.domain.exception.AdrNotFoundException;
import org.finos.calm.domain.exception.AdrRevisionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;

import java.util.List;

public interface AdrStore {

    List<Integer> getAdrsForNamespace(String namespace) throws NamespaceNotFoundException;
    Adr createAdrForNamespace(Adr adr) throws NamespaceNotFoundException, JsonProcessingException;
    Adr getAdr(Adr adr) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, JsonProcessingException;
    List<Integer> getAdrRevisions(Adr adr) throws NamespaceNotFoundException, AdrNotFoundException;
    Adr getAdrRevision(Adr adr) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, JsonProcessingException;
    Adr updateAdrForNamespace(Adr adr) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, JsonProcessingException;
}
