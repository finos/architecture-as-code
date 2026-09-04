package org.finos.calm.store.github.util;

import io.quarkus.security.identity.SecurityIdentity;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.security.OidcRoleResolver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Resolves the set of namespaces the current caller can access based on their
 * OIDC group membership and each namespace's configured access groups. Used by
 * GitHub-mode stores to restrict domain/control visibility to namespaces the
 * caller is authorised to read.
 */
@ApplicationScoped
public class NamespaceAccessFilter {

    private static final Logger LOG = LoggerFactory.getLogger(NamespaceAccessFilter.class);

    @Inject
    SecurityIdentity identity;

    @Inject
    OidcRoleResolver roleResolver;

    @Inject
    InMemoryRegistryService registryService;

    @Inject
    GitHubCloneManager cloneManager;

    @Inject
    @ConfigProperty(name = "calm.auth.enabled", defaultValue = "false")
    boolean authEnabled;

    public Set<String> getAccessibleNamespaces() {
        List<String> allNamespaces = registryService.getSnapshot().getNamespaces();

        if (!authEnabled) {
            return new HashSet<>(allNamespaces);
        }

        if (identity == null || identity.isAnonymous()) {
            return Set.of();
        }

        Set<String> accessible = new HashSet<>();
        for (String namespace : allNamespaces) {
            Set<String> accessGroups = cloneManager.getAccessGroupsForNamespace(namespace);
            if (roleResolver.resolve(identity, accessGroups) != OidcRoleResolver.AccessLevel.NONE) {
                accessible.add(namespace);
            }
        }

        LOG.debug("User [{}] has access to {} of {} namespaces",
                identity.getPrincipal().getName(), accessible.size(), allNamespaces.size());

        return accessible;
    }
}
