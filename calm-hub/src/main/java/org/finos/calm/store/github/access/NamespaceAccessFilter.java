package org.finos.calm.store.github.access;

import io.quarkus.arc.lookup.LookupIfProperty;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.security.OidcRoleResolver;
import org.finos.calm.store.github.registry.ResourceRegistry;
import org.finos.calm.store.github.sync.GitHubCloneManager;
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
@LookupIfProperty(name = "calm.database.mode", stringValue = "github")
@ApplicationScoped
public class NamespaceAccessFilter {

    private static final Logger LOG = LoggerFactory.getLogger(NamespaceAccessFilter.class);

    private final SecurityIdentity identity;
    private final OidcRoleResolver roleResolver;
    private final ResourceRegistry registryService;
    private final GitHubCloneManager cloneManager;
    private final boolean authEnabled;

    @Inject
    public NamespaceAccessFilter(SecurityIdentity identity,
                                  OidcRoleResolver roleResolver,
                                  ResourceRegistry registryService,
                                  GitHubCloneManager cloneManager,
                                  @ConfigProperty(name = "calm.auth.enabled", defaultValue = "false") boolean authEnabled) {
        this.identity = identity;
        this.roleResolver = roleResolver;
        this.registryService = registryService;
        this.cloneManager = cloneManager;
        this.authEnabled = authEnabled;
    }

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
