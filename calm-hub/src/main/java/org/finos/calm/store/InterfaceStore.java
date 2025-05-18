package org.finos.calm.store;

import org.finos.calm.domain.Interface;
import org.finos.calm.domain.InterfaceMeta;
import org.finos.calm.domain.exception.NamespaceNotFoundException;

import java.util.List;

public interface InterfaceStore {

    Interface createInterfaceForNamespace(Interface interfaceBody) throws NamespaceNotFoundException;
    List<InterfaceMeta> getInterfacesForNamespace(String namespace) throws NamespaceNotFoundException;
}
