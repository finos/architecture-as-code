package org.finos.calm.store;

import org.finos.calm.domain.Adr;
import org.finos.calm.domain.Architecture;
import org.finos.calm.domain.exception.NamespaceNotFoundException;

import java.util.List;

public interface AdrStore {

    List<Integer> getAdrsForNamespace(String namespace) throws NamespaceNotFoundException;
    Adr createAdrForNamespace(Adr adr) throws NamespaceNotFoundException;
}
