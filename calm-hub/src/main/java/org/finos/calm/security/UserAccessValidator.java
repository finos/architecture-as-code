package org.finos.calm.security;

import io.quarkus.arc.profile.IfBuildProfile;
import jakarta.enterprise.context.ApplicationScoped;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.store.UserAccessStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.finos.calm.security.CalmHubPermissionChecker.ancestorChain;

@ApplicationScoped
@IfBuildProfile(anyOf = {"secure", "proxy-auth"})
public class UserAccessValidator {

    private static final Logger logger = LoggerFactory.getLogger(UserAccessValidator.class);

    private final UserAccessStore userAccessStore;

    public UserAccessValidator(UserAccessStore userAccessStore) {
        this.userAccessStore = userAccessStore;
    }

    /**
     * Returns the exact set of namespaces the given user can read under the hierarchical
     * entitlement model. A namespace is included only if every level in its ancestor chain
     * has a READ-sufficient grant (own or {@code *}) — the same AND rule enforced by
     * {@link CalmHubPermissionChecker#canRead}.
     *
     * <p>{@link UserAccessStore#getGrantsForUser} returns both the user's own grants and
     * all {@code *} grants in a single query, so the set of candidates is complete.
     * Any namespace that passes the AND ancestor-chain check here will also pass
     * {@code canRead}, guaranteeing that search results never trigger a 403 on click-through.
     *
     * @param username the username to check access for
     * @return the set of namespace names the user can read; empty set if no grants exist
     */
    public Set<String> getReadableNamespaces(String username) {
        List<UserAccess> grants = userAccessStore.getGrantsForUser(username);
        if (grants.isEmpty()) {
            logger.debug("No access grants found for user [{}]", username);
            return Set.of();
        }

        // Namespaces covered by at least one READ-sufficient grant (own or *)
        Set<String> readableGranted = grants.stream()
                .filter(g -> g.getNamespace() != null && isReadSufficient(g))
                .map(UserAccess::getNamespace)
                .collect(Collectors.toSet());

        // Keep only those whose full ancestor chain is also covered
        return readableGranted.stream()
                .filter(ns -> ancestorChain(ns).stream().allMatch(readableGranted::contains))
                .collect(Collectors.toSet());
    }

    private boolean isReadSufficient(UserAccess grant) {
        return grant.getPermission() == UserAccess.Permission.read
                || grant.getPermission() == UserAccess.Permission.write
                || grant.getPermission() == UserAccess.Permission.admin;
    }
}
