package org.finos.calm.store;

import org.bson.json.JsonParseException;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.UserAccessNotFoundException;

import java.util.List;

public interface UserAccessStore {

    UserAccess createUserAccessForNamespace(UserAccess userAccess) throws NamespaceNotFoundException, JsonParseException;

    List<UserAccess> getUserAccessForUsername(String username) throws NamespaceNotFoundException, JsonParseException, UserAccessNotFoundException;

    List<UserAccess> getUserAccessForNamespace(String namespace) throws NamespaceNotFoundException, JsonParseException, UserAccessNotFoundException;
}
