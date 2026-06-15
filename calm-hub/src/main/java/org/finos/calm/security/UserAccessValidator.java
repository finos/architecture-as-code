package org.finos.calm.security;

import io.quarkus.arc.profile.IfBuildProfile;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.store.UserAccessStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import static org.finos.calm.security.CalmHubPermissionChecker.GLOBAL_ACCESS;
import static org.finos.calm.security.CalmHubPermissionChecker.ancestorChain;

@ApplicationScoped
@IfBuildProfile(anyOf = {"secure", "proxy-auth"})
public class UserAccessValidator {

    private static final Logger logger = LoggerFactory.getLogger(UserAccessValidator.class);

    private final UserAccessStore userAccessStore;

    @Inject
    @ConfigProperty(name = "calm.auth.allow-public-read", defaultValue = "false")
    boolean allowPublicRead;

    public UserAccessValidator(UserAccessStore userAccessStore) {
        this.userAccessStore = userAccessStore;
    }

    /**
     * Returns the set of namespaces the given user can read, or {@link Optional#empty()}
     * when the user can read all namespaces without restriction.
     *
     * <p>{@code Optional.empty()} (read everything) is returned when:
     * <ul>
     *   <li>{@code calm.auth.allow-public-read=true} — every namespace is publicly readable</li>
     *   <li>the user holds a {@code GLOBAL admin} grant</li>
     * </ul>
     *
     * <p>Otherwise a namespace is included only if every level in its ancestor chain
     * has a READ-sufficient grant (own or {@code *}) — the same AND rule enforced by
     * {@link CalmHubPermissionChecker#canRead}.  An empty {@code Optional.of(Set.of())}
     * is returned when the user has no grants at all.
     *
     * <p>{@link UserAccessStore#getGrantsForUser} returns both the user's own grants and
     * all {@code *} grants in a single query, so the set of candidates is complete.
     * Any namespace that passes the AND ancestor-chain check here will also pass
     * {@code canRead}, guaranteeing that search results never trigger a 403 on click-through.
     *
     * @param username the username to check access for
     * @return {@link Optional#empty()} if the user can read all namespaces; otherwise
     *         an {@code Optional} containing the specific (possibly empty) set of readable namespaces
     */
    public Optional<Set<String>> getReadableNamespaces(String username) {
        if (allowPublicRead) {
            logger.debug("calm.auth.allow-public-read is true — all namespaces readable for search");
            return Optional.empty();
        }

        List<UserAccess> grants = userAccessStore.getGrantsForUser(username);

        if (isGlobalAdmin(grants)) {
            logger.debug("User [{}] has GLOBAL admin grant — all namespaces readable for search", username);
            return Optional.empty();
        }

        if (grants.isEmpty()) {
            logger.debug("No access grants found for user [{}]", username);
            return Optional.of(Set.of());
        }

        // Namespaces covered by at least one READ-sufficient grant (own or *)
        Set<String> readableGranted = grants.stream()
                .filter(g -> g.getNamespace() != null && isReadSufficient(g))
                .map(UserAccess::getNamespace)
                .collect(Collectors.toSet());

        // Keep only those whose full ancestor chain is also covered
        return Optional.of(readableGranted.stream()
                .filter(ns -> ancestorChain(ns).stream().allMatch(readableGranted::contains))
                .collect(Collectors.toSet()));
    }

    private boolean isGlobalAdmin(List<UserAccess> grants) {
        return grants.stream().anyMatch(g ->
                GLOBAL_ACCESS.equals(g.getNamespace())
                        && g.getPermission() == UserAccess.Permission.admin);
    }

    private boolean isReadSufficient(UserAccess grant) {
        return grant.getPermission() == UserAccess.Permission.read
                || grant.getPermission() == UserAccess.Permission.write
                || grant.getPermission() == UserAccess.Permission.admin;
    }
}
