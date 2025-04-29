package org.finos.calm.store;

import org.finos.calm.domain.Domain;
import org.finos.calm.domain.exception.DomainAlreadyExistsException;

import java.util.List;

public interface DomainStore {
    List<String> getDomains();
    Domain createDomain(String name) throws DomainAlreadyExistsException;
}
