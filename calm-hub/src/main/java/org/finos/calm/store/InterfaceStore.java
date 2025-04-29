package org.finos.calm.store;

import org.finos.calm.domain.Interface;
import org.finos.calm.domain.exception.NamespaceNotFoundException;

public interface InterfaceStore {

    Interface createInterfaceForNamespace(Interface interfaceBody) throws NamespaceNotFoundException;
}
