package org.finos.calm.store;

import org.finos.calm.domain.UserAccess;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.UserAccessNotFoundException;

import java.util.List;

public interface UserAccessStore {

    UserAccess createUserAccessForNamespace(UserAccess userAccess) throws NamespaceNotFoundException;

    List<UserAccess> getUserAccessForUsername(String username) throws UserAccessNotFoundException;

    List<UserAccess> getUserAccessForNamespace(String namespace) throws NamespaceNotFoundException, UserAccessNotFoundException;

    UserAccess getUserAccessForNamespaceAndId(String namespace, Integer userAccessId) throws NamespaceNotFoundException, UserAccessNotFoundException;
}
