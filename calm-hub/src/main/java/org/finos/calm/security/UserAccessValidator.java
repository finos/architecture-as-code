package org.finos.calm.security;

import io.quarkus.arc.profile.IfBuildProfile;
import jakarta.enterprise.context.ApplicationScoped;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.domain.exception.UserAccessNotFoundException;
import org.finos.calm.store.UserAccessStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@ApplicationScoped
@IfBuildProfile(anyOf = {"secure", "proxy-auth"})
public class UserAccessValidator {

    private static final Logger logger = LoggerFactory.getLogger(UserAccessValidator.class);

    private final UserAccessStore userAccessStore;

    public UserAccessValidator(UserAccessStore userAccessStore) {
        this.userAccessStore = userAccessStore;
    }

    /**
     * Returns the set of namespaces the given user has read access to,
     * based on their access grants. Both read and write permissions grant read access.
     *
     * @param username the username to check access for
     * @return a set of namespace names the user can read; empty set if no grants exist
     */
    public Set<String> getReadableNamespaces(String username) {
        try {
            List<UserAccess> userAccesses = userAccessStore.getUserAccessForUsername(username);
            return userAccesses.stream()
                    .map(UserAccess::getNamespace)
                    .collect(Collectors.toSet());
        } catch (UserAccessNotFoundException ex) {
            logger.debug("No access permissions found for user [{}]", username);
            return Set.of();
        }
    }
}
